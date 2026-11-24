# AI-Integrated IoT Health Monitoring System with Predictive Analytics (Pulsepoint)

An academic software and machine learning prototype developed for the **B.Tech Final Year Project ** in the **Department of Computer Science & Engineering (Data Science)** at **Haldia Institute of Technology**.

> **Academic & Clinical Disclaimer:** This application is a software and machine learning prototype built for educational demonstration. Risk classifications, simulated vitals, and anomaly alerts are **not** medical diagnoses and must not be used for clinical decision-making.

---

## 1. Project Overview

Continuous monitoring of core physiological vitals—**Heart Rate (bpm)**, **Blood Oxygen Saturation (% SpO₂)**, and **Body Temperature (°C)**—enables early detection of abnormal physiological trends. 

In accordance with faculty review guidelines, the current phase focuses on the **software backend, interactive web dashboard, and machine learning inference pipeline** using simulated streaming data and benchmark datasets, prior to physical sensor integration.

### Core Capabilities
* **Live Vital-Sign Dashboard (`Pulsepoint`):** Real-time visualization of Heart Rate, SpO₂, and Body Temperature with interactive trend charts and alert logs.
* **Presentation Demo Scenarios:** One-click simulation presets (*Normal*, *Needs attention*, *High risk*) to demonstrate system behavior during live evaluations.
* **Machine Learning Risk Classification:** Evaluates incoming vital signs using trained classification models (`Random Forest` vs. `Logistic Regression` baseline) alongside clinical safety thresholds.
* **Local Persistence:** Lightweight Python HTTP server backed by SQLite (`health_data.sqlite3`) for storing and querying historical readings.

---

## 2. Team & Project Guide

* **Team Members:**
  * Amrita Kumari
  * Abhijeet Kumar Singh
  * Abhay Kumar Sharma
  * Anand Kumar
* **Project Guide:** Mr. Asis Kumar Bhunia, Dept. of CSE (Data Science), Haldia Institute of Technology

---

## 3. Repository Structure

```text
ai-iot-health-monitoring-main/
└── bu/
    ├── server.py                                           # Python HTTP server, SQLite API, and risk scoring engine
    ├── train_model.py                                      # ML preprocessing, model comparison, and artifact export
    ├── risk_model.joblib                                   # Serialized trained Random Forest model (generated)
    ├── Synthetic_patient-HealthCare-Monitoring_dataset.csv # Benchmark dataset (60,000 records
