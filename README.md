# 📊 OmniData Holding — Integrated Business Data Analytics & Executive Decision Support

> **Batch-Processing Big Data Platform** for Telecom Customer Analytics & Churn Analysis

![Architecture](https://img.shields.io/badge/Architecture-Batch%20Processing-blue)
![Stack](https://img.shields.io/badge/Stack-Hadoop%20%7C%20Spark%20%7C%20Hive-orange)
![Year](https://img.shields.io/badge/Year-2026-success)

## 🏗️ Architecture Pipeline

```mermaid
flowchart TD
    A["📊 1. Raw Data<br/>Telco Churn CSV"] --> B["☁️ 2. Data Ingestion<br/>Validate & Prepare"]
    B --> C["⚡ 3. Apache Spark<br/>Clean • Transform • Analyze"]
    C --> D["📐 4. Parquet<br/>Columnar Format"]
    D --> E["🐘 5. Hadoop HDFS<br/>Distributed Storage"]
    E --> F["🐝 6. Apache Hive<br/>SQL Analytics"]
    F --> G["📈 7. Power BI<br/>Executive Dashboards"]
    G --> H["💡 8. Business Insights"]

    style A fill:#0d3b66,color:#fff
    style C fill:#e25a1c,color:#fff
    style F fill:#1a6b3c,color:#fff
    style G fill:#f2a900,color:#1a1a1a
    style H fill:#0d3b66,color:#fff
```

## 📌 Project Overview

An end-to-end **Big Data Analytics Platform** for **OmniData Holding** that integrates sector-level data into a unified analytical environment. The platform stores data using **HDFS**, processes it with **Apache Spark**, organizes it via **Parquet & Hive**, and presents executive insights through **Power BI dashboards**.

| Item | Details |
|------|---------|
| **Company** | OmniData Holding |
| **Architecture** | Batch Processing |
| **Primary Use Case** | Telecom Customer Analytics & Churn Analysis |
| **Dataset** | Telco Customer Churn Dataset |

> ⚠️ **Architecture Requirement:** This project strictly follows a **Batch Processing Architecture**. Kafka, Flume, Zookeeper, and Spark Streaming are explicitly excluded.

## 🛠️ Tech Stack

| Technology | Role in the Project |
|------------|---------------------|
| 🐧 Linux | Project execution environment |
| 🐘 Hadoop HDFS | Distributed data storage |
| ⚡ Apache Spark | Data processing & transformation |
| 📐 Parquet | Columnar storage format |
| 🐝 Apache Hive | Data warehouse & SQL analytics |
| 📊 Power BI | Interactive dashboards |
| 🐙 GitHub | Version control & collaboration |

## 📂 Repository Structure

```
├── data/          # Raw & processed datasets
├── ingestion/     # Data collection & HDFS loading scripts
├── spark/         # PySpark cleaning, transformation & analysis jobs
├── hive/          # HQL scripts: tables & analytics queries
├── powerbi/       # Dashboard file (.pbix)
└── docs/          # Proposal & architecture documentation
```

## ⚙️ Quick Start

```bash
# 0. One-time environment setup (Ubuntu)
bash setup_environment.sh && source ~/.bashrc

# 1. Run the full pipeline
bash run_all.sh

# 2. Open Power BI dashboard
#    powerbi/churn_dashboard.pbix
```

## 📈 Key Deliverables

- ✅ Fully functional batch Big Data pipeline (Hadoop, Spark, Hive)
- ✅ Cleaned dataset stored in optimized Parquet format
- ✅ Hive analytical tables with churn business metrics
- ✅ Interactive Power BI dashboard (KPIs & churn insights)
- ✅ Complete documentation & source code on GitHub

## 👥 Team Members

| # | Name |
|---|------|
| 1 | Hamada El-Khatib Gomaa Eid |
| 2 | Mohamed Atef Massad Bayoumi |
| 3 | Mennatallah Taha |
| 4 | Malak Mohamed |
| 5 | Zahraa Alaa Nassar |

---
**OmniData Holding © 2026 — Big Data Project Proposal**
