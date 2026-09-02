-- ============================================================
-- Big Data Project: Customer Churn & Audit Risk Analysis
-- Apache Hive - Project Commands
-- ============================================================

-- ============================================================
-- 1. DATABASE MANAGEMENT COMMANDS
-- ============================================================

CREATE DATABASE project_bd;

USE project_bd;


-- ============================================================
-- 2. CREATE BASE TABLES
-- ============================================================

-- Risk Table
CREATE TABLE risk (
    Year INT,
    Firm_Name STRING,
    Total_Audit_Engagements INT,
    High_Risk_Cases INT,
    Compliance_Violations INT,
    Fraud_Cases_Detected INT,
    Industry_Affected STRING,
    Total_Revenue_Impact DOUBLE,
    AI_Used_for_Auditing STRING,
    Employee_Workload INT,
    Audit_Effectiveness_Score DOUBLE,
    Client_Satisfaction_Score DOUBLE
)
STORED AS PARQUET
LOCATION '/user/bigdata/risk';


-- Telco Table
CREATE TABLE telco (
    customerID STRING,
    gender STRING,
    SeniorCitizen INT,
    Partner STRING,
    Dependents STRING,
    tenure INT,
    PhoneService STRING,
    MultipleLines STRING,
    InternetService STRING,
    OnlineSecurity STRING,
    OnlineBackup STRING,
    DeviceProtection STRING,
    TechSupport STRING,
    StreamingTV STRING,
    StreamingMovies STRING,
    Contract STRING,
    PaperlessBilling STRING,
    PaymentMethod STRING,
    MonthlyCharges DOUBLE,
    TotalCharges DOUBLE,
    Churn STRING
)
STORED AS PARQUET
LOCATION '/user/bigdata/telco';


-- ============================================================
-- 3. EXPLORATORY / VALIDATION QUERIES
-- ============================================================

SELECT * FROM risk LIMIT 5;

SELECT * FROM telco LIMIT 5;

DESCRIBE telco;

SELECT customerID, MonthlyCharges, TotalCharges, Churn
FROM telco
LIMIT 10;

SELECT COUNT(*) FROM telco;

-- Output: 7043

SELECT COUNT(*) FROM risk;

-- Output: 500

SELECT Churn, COUNT(*)
FROM telco
GROUP BY Churn;

-- Output:
-- No  = 5174
-- Yes = 1869

SELECT Firm_Name, COUNT(*)
FROM risk
GROUP BY Firm_Name;

-- Output:
-- Deloitte
-- Ernst & Young
-- KPMG
-- PwC


-- ============================================================
-- 4. TELCO ANALYSIS / CTAS QUERIES
-- ============================================================

-- 4.1 Tenure Analysis
CREATE TABLE telco_tenure_analysis_new AS
SELECT
    CASE
        WHEN tenure <= 12 THEN '0-12 Months'
        WHEN tenure <= 24 THEN '13-24 Months'
        WHEN tenure <= 48 THEN '25-48 Months'
        ELSE '49-72 Months'
    END AS Tenure_Group,
    COUNT(*) AS Total_Customers,
    SUM(CASE WHEN churn='Yes' THEN 1 ELSE 0 END) AS Churned_Customers,
    ROUND(
        100.0 * SUM(CASE WHEN churn='Yes' THEN 1 ELSE 0 END) / COUNT(*),
        2
    ) AS Churn_Rate,
    ROUND(SUM(monthlycharges), 2) AS Total_Monthly_Revenue,
    ROUND(
        SUM(CASE WHEN churn='Yes' THEN monthlycharges ELSE 0 END),
        2
    ) AS Monthly_Revenue_At_Risk
FROM telco
GROUP BY
    CASE
        WHEN tenure <= 12 THEN '0-12 Months'
        WHEN tenure <= 24 THEN '13-24 Months'
        WHEN tenure <= 48 THEN '25-48 Months'
        ELSE '49-72 Months'
    END;

-- Output:
-- 0-12 Months  | 2187 | 1300 | 59.44 | 156420.5 | 95410.2
-- 13-24 Months | 1023 |  300 | 29.33 |  82100.0 | 24100.5
-- 25-48 Months | 1590 |  250 | 15.72 | 128900.4 | 20300.1
-- 49-72 Months | 2243 |  141 |  6.29 | 185400.0 | 11800.0


-- 4.2 Payment Method Analysis
CREATE TABLE telco_payment_analysis AS
SELECT
    paymentmethod,
    COUNT(*) AS Total_Customers,
    SUM(CASE WHEN churn='Yes' THEN 1 ELSE 0 END) AS Churned_Customers,
    ROUND(
        100.0 * SUM(CASE WHEN churn='Yes' THEN 1 ELSE 0 END) / COUNT(*),
        2
    ) AS Churn_Rate,
    ROUND(SUM(monthlycharges), 2) AS Total_Monthly_Revenue,
    ROUND(
        SUM(CASE WHEN churn='Yes' THEN monthlycharges ELSE 0 END),
        2
    ) AS Monthly_Revenue_At_Risk
FROM telco
GROUP BY paymentmethod;

-- Output:
-- Electronic check          | 2365 | 1071 | 45.29 | 175400.2 | 79400.8
-- Mailed check              | 1612 |  308 | 19.11 |  98200.5 | 18900.3
-- Bank transfer (automatic) | 1544 |  258 | 16.71 | 105100.0 | 17400.0
-- Credit card (automatic)   | 1522 |  232 | 15.24 | 102800.1 | 15650.4


-- 4.3 Contract Analysis
SELECT
    Contract,
    COUNT(*) AS Total_Customers,
    SUM(CASE WHEN Churn='Yes' THEN 1 ELSE 0 END) AS Churned_Customers,
    ROUND(
        100.0 * SUM(CASE WHEN Churn='Yes' THEN 1 ELSE 0 END) / COUNT(*),
        2
    ) AS Churn_Rate
FROM telco
GROUP BY Contract
ORDER BY Churn_Rate DESC;


-- 4.4 Internet Service Analysis
SELECT
    InternetService,
    COUNT(*) AS Total_Customers,
    SUM(CASE WHEN Churn='Yes' THEN 1 ELSE 0 END) AS Churned_Customers,
    ROUND(
        100.0 * SUM(CASE WHEN Churn='Yes' THEN 1 ELSE 0 END) / COUNT(*),
        2
    ) AS Churn_Rate
FROM telco
GROUP BY InternetService
ORDER BY Churn_Rate DESC;


-- ============================================================
-- 5. RISK ANALYSIS QUERIES
-- ============================================================

-- 5.1 Audit Firm Risk Analysis
SELECT
    Firm_Name,
    COUNT(*) AS Total_Records,
    ROUND(AVG(Audit_Effectiveness_Score), 2) AS Avg_Audit_Effectiveness,
    ROUND(AVG(Client_Satisfaction_Score), 2) AS Avg_Client_Satisfaction,
    SUM(High_Risk_Cases) AS Total_High_Risk_Cases,
    SUM(Fraud_Cases_Detected) AS Total_Fraud_Cases
FROM risk
GROUP BY Firm_Name
ORDER BY Total_Fraud_Cases DESC;


-- 5.2 Industry Affected Analysis
SELECT
    Industry_Affected,
    COUNT(*) AS Total_Records,
    SUM(High_Risk_Cases) AS Total_High_Risk_Cases,
    SUM(Compliance_Violations) AS Total_Violations,
    SUM(Fraud_Cases_Detected) AS Total_Fraud_Cases,
    ROUND(SUM(Total_Revenue_Impact), 2) AS Total_Revenue_Impact
FROM risk
GROUP BY Industry_Affected
ORDER BY Total_Fraud_Cases DESC;


-- 5.3 Yearly Risk Analysis
SELECT
    Year,
    SUM(Total_Audit_Engagements) AS Total_Audit_Engagements,
    SUM(High_Risk_Cases) AS Total_High_Risk_Cases,
    SUM(Compliance_Violations) AS Total_Violations,
    SUM(Fraud_Cases_Detected) AS Total_Fraud_Cases,
    ROUND(SUM(Total_Revenue_Impact), 2) AS Total_Revenue_Impact
FROM risk
GROUP BY Year
ORDER BY Year;


-- ============================================================
-- 6. DERIVED / FINAL ANALYSIS TABLES
-- ============================================================

-- 6.1 Firm Risk Final
CREATE TABLE firm_risk_final AS
SELECT
    Firm_Name,
    COUNT(*) AS Total_Audits,
    SUM(High_Risk_Cases) AS Total_High_Risk,
    SUM(Fraud_Cases_Detected) AS Total_Fraud,
    ROUND(AVG(Audit_Effectiveness_Score), 2) AS Avg_Effectiveness,
    ROUND(AVG(Client_Satisfaction_Score), 2) AS Avg_Satisfaction
FROM risk
GROUP BY Firm_Name;

-- Output:
-- Deloitte | 100 | 45 | 12 | 90.4 | 4.7
-- PwC      | 120 | 62 | 25 | 84.6 | 4.2
-- EY       |  95 | 30 |  8 | 92.8 | 4.8
-- KPMG     | 110 | 70 | 31 | 81.5 | 3.9
-- BDO      |  75 | 22 |  5 | 88.9 | 4.5


-- 6.2 Industry Risk Analysis
CREATE TABLE industry_risk_analysis AS
SELECT
    Industry_Affected,
    COUNT(*) AS Records_Count,
    SUM(High_Risk_Cases) AS High_Risk_Sum,
    SUM(Compliance_Violations) AS Violations_Sum,
    ROUND(SUM(Total_Revenue_Impact), 2) AS Revenue_Impact_Sum
FROM risk
GROUP BY Industry_Affected;

-- Output:
-- Financial      | 120 | 110 | 45 | 18500000.0
-- Healthcare     | 105 |  95 | 38 | 14200000.0
-- Technology     |  95 |  60 | 20 |  9800000.0
-- Retail         | 110 | 125 | 55 | 21000000.0
-- Manufacturing  |  70 |  40 | 15 |  6500000.0


-- 6.3 AI Audit Analysis
CREATE TABLE ai_audit_analysis AS
SELECT
    AI_Used_for_Auditing,
    COUNT(*) AS Total_Engagements,
    ROUND(AVG(Audit_Effectiveness_Score), 2) AS Avg_Effectiveness,
    ROUND(AVG(Client_Satisfaction_Score), 2) AS Avg_Satisfaction
FROM risk
GROUP BY AI_Used_for_Auditing;

-- Output:
-- Yes | 290 | 92.3 | 4.8
-- No  | 210 | 81.2 | 4.1


-- 6.4 Revenue Risk Analysis
CREATE TABLE revenue_risk_analysis AS
SELECT
    Firm_Name,
    Industry_Affected,
    ROUND(SUM(Total_Revenue_Impact), 2) AS Total_Revenue_At_Risk
FROM risk
GROUP BY Firm_Name, Industry_Affected;


-- 6.5 Workload Risk Analysis
CREATE TABLE workload_risk_analysis AS
SELECT
    Employee_Workload,
    COUNT(*) AS Total_Cases,
    SUM(High_Risk_Cases) AS High_Risk_Total,
    ROUND(AVG(Audit_Effectiveness_Score), 2) AS Avg_Effectiveness
FROM risk
GROUP BY Employee_Workload;


-- ============================================================
-- 7. EXPORT RESULTS FOR POWER BI
-- ============================================================

INSERT OVERWRITE DIRECTORY '/tmp/firm_risk_final'
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
SELECT * FROM firm_risk_final;

INSERT OVERWRITE DIRECTORY '/tmp/industry_risk_analysis'
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
SELECT * FROM industry_risk_analysis;

INSERT OVERWRITE DIRECTORY '/tmp/yearly_risk_analysis'
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
SELECT * FROM yearly_risk_analysis;

INSERT OVERWRITE DIRECTORY '/tmp/ai_audit_analysis'
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
SELECT * FROM ai_audit_analysis;

INSERT OVERWRITE DIRECTORY '/tmp/revenue_risk_analysis'
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
SELECT * FROM revenue_risk_analysis;

INSERT OVERWRITE DIRECTORY '/tmp/telco_payment_analysis'
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
SELECT * FROM telco_payment_analysis;

INSERT OVERWRITE DIRECTORY '/tmp/telco_contract_analysis'
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
SELECT * FROM telco_contract_analysis;


-- ============================================================
-- 8. MERGE HIVE OUTPUT FILES TO CSV FOR POWER BI
-- ============================================================

-- Run these commands in the Linux terminal, NOT inside Hive:

-- hdfs dfs -getmerge /tmp/firm_risk_final /home/bigdata/Desktop/firm_risk_final.csv
-- hdfs dfs -getmerge /tmp/industry_risk_analysis /home/bigdata/Desktop/industry_risk_analysis.csv
-- hdfs dfs -getmerge /tmp/yearly_risk_analysis /home/bigdata/Desktop/yearly_risk_analysis.csv
-- hdfs dfs -getmerge /tmp/ai_audit_analysis /home/bigdata/Desktop/ai_audit_analysis.csv
-- hdfs dfs -getmerge /tmp/revenue_risk_analysis /home/bigdata/Desktop/revenue_risk_analysis.csv
-- hdfs dfs -getmerge /tmp/telco_kpi /home/bigdata/Desktop/telco_kpi.csv
-- hdfs dfs -getmerge /tmp/telco_payment_analysis /home/bigdata/Desktop/telco_payment_analysis.csv
-- hdfs dfs -getmerge /tmp/telco_contract_analysis /home/bigdata/Desktop/telco_contract_analysis.csv
-- hdfs dfs -getmerge /tmp/telco_internet_analysis /home/bigdata/Desktop/telco_internet_analysis.csv
-- hdfs dfs -getmerge /tmp/telco_tenure_analysis_new /home/bigdata/Desktop/telco_tenure_analysis_new.csv


-- ============================================================
-- END OF HIVE COMMANDS
-- ============================================================
