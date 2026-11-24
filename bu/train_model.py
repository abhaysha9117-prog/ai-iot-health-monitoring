import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

# 1. Load dataset
CSV_FILE = "Synthetic_patient-HealthCare-Monitoring_dataset.csv"
df = pd.read_csv(CSV_FILE)
print(f"Loaded {len(df)} rows and {len(df.columns)} columns.")

# 2. Define 3 input features matching our prototype sensors (HR, SpO2, Temperature)
FEATURES = ["Heart Rate (bpm)", "SpO2 Level (%)", "Body Temperature (°C)"]
X = df[FEATURES]

# 3. Create 3-tier target label matching the dashboard ('Low', 'Moderate', 'High')
# Based on how many of the 3 sensor parameters triggered an abnormal alert
abnormal_count = (
    (df["Heart Rate Alert"] == "ABNORMAL").astype(int)
    + (df["SpO2 Level Alert"] == "ABNORMAL").astype(int)
    + (df["Temperature Alert"] == "ABNORMAL").astype(int)
)
y = abnormal_count.map({0: "Low", 1: "Moderate", 2: "High", 3: "High"})

print("\nTarget Class Distribution:")
print(y.value_counts())

# 4. Split data (80% Train, 20% Test) BEFORE scaling to avoid data leakage
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)

# 5. Model 1: Logistic Regression (Baseline with StandardScaler)
lr_model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000, random_state=42))
lr_model.fit(X_train, y_train)
lr_preds = lr_model.predict(X_test)

print("\n--- MODEL 1: LOGISTIC REGRESSION (BASELINE) ---")
print(f"Accuracy: {accuracy_score(y_test, lr_preds):.4f}")
print(classification_report(y_test, lr_preds))

# 6. Model 2: Random Forest Classifier
rf_model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
rf_model.fit(X_train, y_train)
rf_preds = rf_model.predict(X_test)

print("\n--- MODEL 2: RANDOM FOREST CLASSIFIER ---")
print(f"Accuracy: {accuracy_score(y_test, rf_preds):.4f}")
print(classification_report(y_test, rf_preds))
print("Confusion Matrix (Order: High, Low, Moderate):")
print(confusion_matrix(y_test, rf_preds, labels=["High", "Low", "Moderate"]))

# 7. Save the trained Random Forest model for server.py integration
joblib.dump(rf_model, "risk_model.joblib")
print("\nSaved trained model to: risk_model.joblib")