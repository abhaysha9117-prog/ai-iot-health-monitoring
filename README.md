# AI-Integrated IoT Health Monitoring System with Predictive Analytics (Pulsepoint)

An academic software and machine learning prototype developed for the **B.Tech Final Year Project (Semester VII)** in the **Department of Computer Science & Engineering (Data Science)** at **Haldia Institute of Technology**.

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

## 2. Team & Role Allocation

| Member | Role | Primary Responsibilities |
| :--- | :--- | :--- |
| **Amrita** | Group Leader & UI/Dashboard Lead | Frontend architecture (`index.html`, `styles.css`, `app.js`), UX workflows, and presentation coordination |
| **Abhijeet Kumar Singh** | Machine Learning & Prediction Lead | Dataset auditing, EDA, preprocessing, model training (`train_model.py`), evaluation, and ML backend integration |
| **Abhay Kumar** | Hardware & Embedded Systems Lead | Sensor interfacing (MAX30102, DS18B20) and microcontroller prototyping *(scheduled post-November)* |
| **Anand** | IoT & Cloud Integration Lead | Telemetry protocols, device-to-server communication, and data pipeline architecture |

* **Project Guide:** Mr. Asis Kumar Bhunia, Dept. of CSE (Data Science), Haldia Institute of Technology

---

## 3. Repository Structure

```text
ai-iot-health-monitoring-main/
└── bu/
    ├── server.py                                           # Python HTTP server, SQLite API, and risk scoring engine
    ├── train_model.py                                      # ML preprocessing, model comparison, and artifact export
    ├── risk_model.joblib                                   # Serialized trained Random Forest model (generated)
    ├── Synthetic_patient-HealthCare-Monitoring_dataset.csv # Benchmark dataset (60,000 records)
    ├── health_data.sqlite3                                 # Local SQLite database for vital readings
    └── static/
        ├── index.html                                      # Main dashboard layout
        ├── app.js                                          # Frontend rendering, charts, and scenario controls
        ├── styles.css                                      # Core dashboard styling
        └── demo.css                                        # Demo controls and status indicator styling
