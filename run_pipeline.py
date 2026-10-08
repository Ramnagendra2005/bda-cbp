"""
ChurnSight — batch Big Data pipeline (local PySpark, no HDFS/Hive required).

  1. Ingest   Telco.csv + risk.csv
  2. Clean    trim text, fix blanks, normalise yes/no columns
  3. Enrich   tenure groups, churn flag, risk & quality ratios
  4. Analyse  Spark SQL KPIs
  5. Store    Parquet (output/telco, output/risk) + output/dashboard_data.json
"""

import os

from analytics import (PROJECT_NAME, OUTPUT_DIR, get_spark, load_telco, load_risk,
                       build_summary, save_summary)


def show(title, rows, columns):
    print(f"\n  {title}")
    widths = [max(len(str(c)), *(len(str(r[c])) for r in rows)) for c in columns]
    print("  " + "  ".join(str(c).ljust(w) for c, w in zip(columns, widths)))
    for r in rows:
        print("  " + "  ".join(str(r[c]).ljust(w) for c, w in zip(columns, widths)))


def main():
    print("=" * 60)
    print(f"  {PROJECT_NAME} — Big Data Analytics Pipeline")
    print("=" * 60)

    spark = get_spark(f"{PROJECT_NAME}_Pipeline")
    try:
        print("\n[1/5] Ingesting + [2/5] cleaning + [3/5] enriching data...")
        telco = load_telco(spark).cache()
        risk = load_risk(spark).cache()
        print(f"      Telecom customers : {telco.count():,} rows, {len(telco.columns)} columns")
        print(f"      Audit records     : {risk.count():,} rows, {len(risk.columns)} columns")

        print("\n[4/5] Running Spark SQL analytics...")
        s = build_summary(spark, telco, risk)
        t, r = s["telco"], s["risk"]
        print(f"\n  Customers: {t['total_customers']:,}   Churned: {t['churned']:,}   "
              f"Churn rate: {t['churn_rate']}%")
        show("Churn by contract", t["by_contract"], ["label", "customers", "churned", "churn_rate"])
        show("Churn by tenure", t["by_tenure"], ["label", "customers", "churn_rate"])
        show("Churn by payment method", t["by_payment"], ["label", "customers", "churn_rate"])
        print(f"\n  Audit engagements: {r['total_engagements']:,}   Fraud cases: {r['total_fraud']:,}   "
              f"Avg high-risk share: {r['avg_risk_pct']}%")
        show("Risk by industry", r["by_industry"], ["label", "risk_pct", "fraud"])
        show("AI-assisted vs manual audits", r["ai_vs_manual"], ["label", "records", "avg_quality", "risk_pct"])

        print("\n[5/5] Writing Parquet + dashboard summary...")
        telco.write.mode("overwrite").parquet(os.path.join(OUTPUT_DIR, "telco"))
        risk.write.mode("overwrite").parquet(os.path.join(OUTPUT_DIR, "risk"))
        print(f"      Parquet  -> {os.path.join(OUTPUT_DIR, 'telco')}")
        print(f"      Parquet  -> {os.path.join(OUTPUT_DIR, 'risk')}")
        print(f"      Summary  -> {save_summary(s)}")
    finally:
        spark.stop()

    print("\n" + "=" * 60)
    print("  Pipeline completed successfully!")
    print("  Start the dashboard with:  bash run_dashboard.sh")
    print("=" * 60)


if __name__ == "__main__":
    main()
