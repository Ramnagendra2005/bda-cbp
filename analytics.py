"""
ChurnSight — shared Spark analytics.

One place that knows how to load, clean and summarise the two datasets.
Used by both the batch pipeline (run_pipeline.py) and the dashboard
(dashboard/app.py), so the numbers on screen always match the pipeline.
"""

import json
import os
import time

from pyspark.sql import SparkSession
from pyspark.sql.functions import col, trim, when, round as spark_round
from pyspark.sql.types import StringType

PROJECT_NAME = "ChurnSight"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TELCO_CSV = os.path.join(BASE_DIR, "Telco.csv")
RISK_CSV = os.path.join(BASE_DIR, "risk.csv")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
SUMMARY_JSON = os.path.join(OUTPUT_DIR, "dashboard_data.json")

ADD_ON_SERVICES = ["OnlineSecurity", "TechSupport", "OnlineBackup", "DeviceProtection"]
BINARY_COLS = ["MultipleLines", "OnlineSecurity", "OnlineBackup",
               "DeviceProtection", "TechSupport", "StreamingTV", "StreamingMovies"]


def get_spark(app_name=PROJECT_NAME):
    os.environ.setdefault("SPARK_LOCAL_IP", "127.0.0.1")
    spark = (
        SparkSession.builder
        .appName(app_name)
        .master("local[*]")
        .config("spark.sql.shuffle.partitions", "4")
        .config("spark.ui.showConsoleProgress", "false")
        .config("spark.ui.enabled", "false")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("ERROR")
    return spark


def _trim_strings(df):
    for field in df.schema.fields:
        if isinstance(field.dataType, StringType):
            df = df.withColumn(field.name, trim(col(field.name)))
    return df


def _safe_div(numerator, denominator):
    return numerator / when(denominator == 0, 1).otherwise(denominator)


def load_telco(spark):
    df = spark.read.csv(TELCO_CSV, header=True, inferSchema=True)
    df = _trim_strings(df.dropDuplicates())

    # 11 brand-new customers have a blank TotalCharges -> treat as 0
    df = (
        df.withColumn("TotalCharges",
                      when(col("TotalCharges") == "", None)
                      .otherwise(col("TotalCharges").cast("double")))
        .fillna({"TotalCharges": 0.0})
    )

    # "No internet service" / "No phone service" -> "No"
    for c in BINARY_COLS:
        df = df.withColumn(c, when(col(c).isin("No internet service", "No phone service"), "No")
                           .otherwise(col(c)))

    return (
        df.withColumn("AvgMonthlySpend", spark_round(_safe_div(col("TotalCharges"), col("tenure")), 2))
        .withColumn("TenureYears", spark_round(col("tenure") / 12, 1))
        .withColumn("TenureGroup",
                    when(col("tenure") <= 12, "0-1 Year")
                    .when(col("tenure") <= 24, "1-2 Years")
                    .when(col("tenure") <= 48, "2-4 Years")
                    .otherwise("4+ Years"))
        .withColumn("ChurnFlag", when(col("Churn") == "Yes", 1).otherwise(0).cast("double"))
    )


def load_risk(spark):
    df = spark.read.csv(RISK_CSV, header=True, inferSchema=True)
    df = _trim_strings(df.dropDuplicates())
    df = df.fillna({
        "High_Risk_Cases": 0,
        "Fraud_Cases_Detected": 0,
        "Total_Revenue_Impact": 0.0,
        "Audit_Effectiveness_Score": 0.0,
        "Client_Satisfaction_Score": 0.0,
    })
    engagements = col("Total_Audit_Engagements")
    return (
        df.withColumn("High_Risk_Ratio", spark_round(_safe_div(col("High_Risk_Cases"), engagements), 4))
        .withColumn("Fraud_Detection_Rate", spark_round(_safe_div(col("Fraud_Cases_Detected"), engagements), 4))
        .withColumn("Avg_Revenue_Impact_Per_Engagement",
                    spark_round(_safe_div(col("Total_Revenue_Impact"), engagements), 2))
        .withColumn("Audit_Quality_Score",
                    spark_round((col("Audit_Effectiveness_Score") + col("Client_Satisfaction_Score")) / 2, 2))
    )


def build_summary(spark, telco, risk):
    """Run every Spark SQL query the dashboard needs and return plain Python data."""
    telco.createOrReplaceTempView("telco")
    risk.createOrReplaceTempView("financial")

    def rows(sql):
        return [r.asDict() for r in spark.sql(sql).collect()]

    def one(sql):
        return spark.sql(sql).collect()[0].asDict()

    churn_rate_sql = "ROUND(100.0 * SUM(ChurnFlag) / COUNT(*), 2)"

    t = one(f"""
        SELECT COUNT(*)                                     AS total_customers,
               CAST(SUM(ChurnFlag) AS INT)                  AS churned,
               {churn_rate_sql}                             AS churn_rate,
               ROUND(AVG(MonthlyCharges), 2)                AS avg_monthly,
               ROUND(SUM(TotalCharges), 2)                  AS total_revenue,
               ROUND(SUM(MonthlyCharges), 2)                AS monthly_revenue,
               ROUND(SUM(CASE WHEN Churn='Yes' THEN MonthlyCharges ELSE 0 END), 2) AS monthly_revenue_lost,
               ROUND(AVG(tenure), 1)                        AS avg_tenure_months
        FROM telco
    """)

    def churn_by(expr, order="churn_rate DESC"):
        return rows(f"""
            SELECT {expr} AS label,
                   COUNT(*) AS customers,
                   CAST(SUM(ChurnFlag) AS INT) AS churned,
                   {churn_rate_sql} AS churn_rate,
                   ROUND(AVG(MonthlyCharges), 2) AS avg_monthly
            FROM telco GROUP BY {expr} ORDER BY {order}
        """)

    t["by_contract"] = churn_by("Contract")
    t["by_tenure"] = churn_by("TenureGroup", order="label")
    t["by_payment"] = churn_by("PaymentMethod")
    t["by_internet"] = churn_by("InternetService")
    t["by_senior"] = churn_by("CASE WHEN SeniorCitizen = 1 THEN 'Senior (65+)' ELSE 'Under 65' END")

    # Do protective add-ons keep customers? (only customers who have internet)
    t["by_addon"] = []
    for svc in ADD_ON_SERVICES:
        r = one(f"""
            SELECT ROUND(100.0 * SUM(CASE WHEN {svc}='Yes' THEN ChurnFlag ELSE 0 END)
                         / SUM(CASE WHEN {svc}='Yes' THEN 1 ELSE 0 END), 2) AS with_rate,
                   ROUND(100.0 * SUM(CASE WHEN {svc}='No' THEN ChurnFlag ELSE 0 END)
                         / SUM(CASE WHEN {svc}='No' THEN 1 ELSE 0 END), 2) AS without_rate
            FROM telco WHERE InternetService <> 'No'
        """)
        r["label"] = svc
        t["by_addon"].append(r)

    r = one("""
        SELECT CAST(SUM(Total_Audit_Engagements) AS BIGINT) AS total_engagements,
               CAST(SUM(High_Risk_Cases) AS BIGINT)         AS total_high_risk,
               CAST(SUM(Fraud_Cases_Detected) AS BIGINT)    AS total_fraud,
               CAST(SUM(Compliance_Violations) AS BIGINT)   AS total_violations,
               ROUND(100.0 * AVG(High_Risk_Ratio), 2)       AS avg_risk_pct,
               ROUND(AVG(Audit_Quality_Score), 2)           AS avg_quality,
               ROUND(SUM(Total_Revenue_Impact), 2)          AS total_revenue_impact,
               COUNT(*)                                     AS records,
               MIN(Year) AS first_year, MAX(Year) AS last_year
        FROM financial
    """)

    r["by_year"] = rows("""
        SELECT Year AS label,
               CAST(SUM(Total_Audit_Engagements) AS BIGINT) AS engagements,
               CAST(SUM(High_Risk_Cases) AS BIGINT)         AS high_risk,
               CAST(SUM(Fraud_Cases_Detected) AS BIGINT)    AS fraud,
               ROUND(SUM(Total_Revenue_Impact), 2)          AS revenue_impact
        FROM financial GROUP BY Year ORDER BY Year
    """)
    r["by_firm"] = rows("""
        SELECT Firm_Name AS label,
               COUNT(*) AS records,
               CAST(SUM(Total_Audit_Engagements) AS BIGINT) AS engagements,
               CAST(SUM(Fraud_Cases_Detected) AS BIGINT)    AS fraud,
               ROUND(100.0 * AVG(High_Risk_Ratio), 2)       AS risk_pct,
               ROUND(AVG(Audit_Quality_Score), 2)           AS avg_quality,
               ROUND(SUM(Total_Revenue_Impact), 2)          AS revenue_impact
        FROM financial GROUP BY Firm_Name ORDER BY revenue_impact DESC
    """)
    r["by_industry"] = rows("""
        SELECT Industry_Affected AS label,
               COUNT(*) AS records,
               ROUND(100.0 * AVG(High_Risk_Ratio), 2)       AS risk_pct,
               CAST(SUM(Fraud_Cases_Detected) AS BIGINT)    AS fraud,
               ROUND(SUM(Total_Revenue_Impact), 2)          AS revenue_impact
        FROM financial GROUP BY Industry_Affected ORDER BY risk_pct DESC
    """)
    r["ai_vs_manual"] = rows("""
        SELECT CASE WHEN AI_Used_for_Auditing = 'Yes' THEN 'AI-assisted' ELSE 'Manual' END AS label,
               COUNT(*) AS records,
               ROUND(AVG(Audit_Effectiveness_Score), 2)     AS effectiveness,
               ROUND(AVG(Client_Satisfaction_Score), 2)     AS satisfaction,
               ROUND(AVG(Audit_Quality_Score), 2)           AS avg_quality,
               ROUND(100.0 * AVG(Fraud_Detection_Rate), 2)  AS fraud_rate_pct,
               ROUND(100.0 * AVG(High_Risk_Ratio), 2)       AS risk_pct
        FROM financial GROUP BY AI_Used_for_Auditing ORDER BY label
    """)

    return {
        "project": PROJECT_NAME,
        "generated_at": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()),
        "spark_version": spark.version,
        "telco": t,
        "risk": r,
    }


def save_summary(summary, path=SUMMARY_JSON):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(summary, f, indent=2, default=str)
    return path


def compute_summary():
    """Start Spark, compute the dashboard summary, save it, stop Spark."""
    spark = get_spark(f"{PROJECT_NAME}_Dashboard")
    try:
        summary = build_summary(spark, load_telco(spark), load_risk(spark))
        save_summary(summary)
        return summary
    finally:
        spark.stop()
