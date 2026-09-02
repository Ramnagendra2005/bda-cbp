# HDFS Commands — Big Data Project

This document records the HDFS commands used during the project workflow.

## Upload Risk Output Files to HDFS

```bash
hdfs dfs -put /home/bigdata/Desktop/output/risk/* /user/bigdata/risk/
```

## Upload Telco Output Files to HDFS

```bash
hdfs dfs -put /home/bigdata/Desktop/output/telco/* /user/bigdata/telco/
```

## Export Hive Analysis Results from HDFS

```bash
hdfs dfs -getmerge /tmp/firm_risk_final /home/bigdata/Desktop/firm_risk_final.csv
hdfs dfs -getmerge /tmp/industry_risk_analysis /home/bigdata/Desktop/industry_risk_analysis.csv
hdfs dfs -getmerge /tmp/yearly_risk_analysis /home/bigdata/Desktop/yearly_risk_analysis.csv
hdfs dfs -getmerge /tmp/ai_audit_analysis /home/bigdata/Desktop/ai_audit_analysis.csv
hdfs dfs -getmerge /tmp/revenue_risk_analysis /home/bigdata/Desktop/revenue_risk_analysis.csv
hdfs dfs -getmerge /tmp/telco_kpi /home/bigdata/Desktop/telco_kpi.csv
hdfs dfs -getmerge /tmp/telco_payment_analysis /home/bigdata/Desktop/telco_payment_analysis.csv
hdfs dfs -getmerge /tmp/telco_contract_analysis /home/bigdata/Desktop/telco_contract_analysis.csv
```

## Exit HDFS Safe Mode

```bash
hdfs dfsadmin -safemode leave
```

## Check HDFS File/Block Health

```bash
hdfs fsck /user/hive/warehouse/project_bd.db/telco_tenure_analysis -files -blocks -locations
```
