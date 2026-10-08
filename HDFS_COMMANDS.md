# HDFS Commands — ChurnSight

HDFS commands for running ChurnSight on a Hadoop cluster (optional — the local pipeline does not need HDFS). Run from the project root; exported CSVs land in `exports/`.

## Upload Risk Output Files to HDFS

```bash
hdfs dfs -put output/risk/* /user/churnsight/risk/
```

## Upload Telco Output Files to HDFS

```bash
hdfs dfs -put output/telco/* /user/churnsight/telco/
```

## Export Hive Analysis Results from HDFS

```bash
hdfs dfs -getmerge /tmp/firm_risk_final exports/firm_risk_final.csv
hdfs dfs -getmerge /tmp/industry_risk_analysis exports/industry_risk_analysis.csv
hdfs dfs -getmerge /tmp/yearly_risk_analysis exports/yearly_risk_analysis.csv
hdfs dfs -getmerge /tmp/ai_audit_analysis exports/ai_audit_analysis.csv
hdfs dfs -getmerge /tmp/revenue_risk_analysis exports/revenue_risk_analysis.csv
hdfs dfs -getmerge /tmp/telco_kpi exports/telco_kpi.csv
hdfs dfs -getmerge /tmp/telco_payment_analysis exports/telco_payment_analysis.csv
hdfs dfs -getmerge /tmp/telco_contract_analysis exports/telco_contract_analysis.csv
```

## Exit HDFS Safe Mode

```bash
hdfs dfsadmin -safemode leave
```

## Check HDFS File/Block Health

```bash
hdfs fsck /user/hive/warehouse/churnsight.db/telco_tenure_analysis -files -blocks -locations
```
