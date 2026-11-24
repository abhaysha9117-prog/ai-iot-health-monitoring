"""Health monitoring prototype server with per-patient SQLite storage & Random Forest ML."""
from __future__ import annotations

import json
import os
import sqlite3
import threading
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import joblib
import pandas as pd

ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("HEALTH_DB", ROOT / "health_data.sqlite3"))
MODEL_PATH = ROOT / "risk_model.joblib"
LOCK = threading.Lock()

ML_MODEL = joblib.load(MODEL_PATH) if MODEL_PATH.exists() else None
FEATURE_COLS = ["Heart Rate (bpm)", "SpO2 Level (%)", "Body Temperature (°C)"]


def risk_for(hr: float, spo2: float, temp: float) -> dict:
    """Predict risk level and confidence score using the trained Random Forest model."""
    reasons = []
    if hr < 60 or hr > 100:
        reasons.append(f"Heart rate abnormal ({hr:.0f} bpm)")
    if spo2 < 95:
        reasons.append(f"SpO₂ below reference ({spo2:.1f}%)")
    if temp >= 37.6 or temp < 35.5:
        reasons.append(f"Body temperature elevated/low ({temp:.1f}°C)")

    if ML_MODEL is not None:
        sample = pd.DataFrame([[hr, spo2, temp]], columns=FEATURE_COLS)
        pred_level = str(ML_MODEL.predict(sample)[0])
        probs = dict(zip(ML_MODEL.classes_, ML_MODEL.predict_proba(sample)[0]))
        score = int(round(probs.get("Moderate", 0.0) * 50 + probs.get("High", 0.0) * 100))
        confidence = int(round(probs.get(pred_level, 1.0) * 100))
        summary = reasons if reasons else ["All 3 vitals within normal range"]
        summary.append(f"Random Forest ML ({confidence}% confidence)")
        return {"score": score, "level": pred_level, "reasons": summary}

    score = min(len(reasons) * 40, 100)
    level = "High" if len(reasons) >= 2 else "Moderate" if len(reasons) == 1 else "Low"
    return {"score": score, "level": level, "reasons": reasons or ["Fallback threshold check"]}


def connect():
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    return db


def seed_patient(db, patient_id: str, base_hr: float = 74, base_spo2: float = 98.0, base_temp: float = 36.6):
    """Create initial demo history for a patient if they have no readings yet."""
    count = db.execute("SELECT COUNT(*) FROM readings WHERE patient_id = ?", (patient_id,)).fetchone()[0]
    if count > 0:
        return
    now = datetime.now(timezone.utc)
    for i in range(16):
        t = now - timedelta(minutes=(15 - i) * 5)
        hr = base_hr + (i % 5) * 2
        spo2 = min(100.0, round(base_spo2 + (i % 3) * 0.2, 1))
        temp = round(base_temp + (i % 4) * 0.1, 1)
        db.execute(
            "INSERT INTO readings(patient_id,timestamp,heart_rate,spo2,temperature,source) VALUES(?,?,?,?,?,?)",
            (patient_id, t.isoformat(), hr, spo2, temp, "demo"),
        )


def init_db():
    with connect() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id TEXT NOT NULL DEFAULT 'PT-101',
            timestamp TEXT NOT NULL,
            heart_rate REAL NOT NULL,
            spo2 REAL NOT NULL,
            temperature REAL NOT NULL,
            source TEXT NOT NULL DEFAULT 'device')""")
        # Migrate older database table if patient_id column doesn't exist yet
        cols = [r["name"] for r in db.execute("PRAGMA table_info(readings)").fetchall()]
        if "patient_id" not in cols:
            db.execute("ALTER TABLE readings ADD COLUMN patient_id TEXT NOT NULL DEFAULT 'PT-101'")
        seed_patient(db, "PT-101", 72, 98.0, 36.6)
        seed_patient(db, "PT-102", 78, 97.5, 36.8)
        seed_patient(db, "PT-103", 84, 96.8, 37.0)
        seed_patient(db, "PT-104", 70, 98.5, 36.5)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args))

    def send_json(self, data, status=200):
        raw = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Device-Key")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self.send_json({"ok": True})

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)
        if path == "/api/health":
            return self.send_json({
                "status": "ok",
                "mode": "prototype",
                "risk_model": "RandomForestClassifier (risk_model.joblib)" if ML_MODEL else "fallback rules",
            })
        if path == "/api/readings":
            patient_id = (qs.get("patient_id", ["PT-101"])[0] or "PT-101").strip().upper()
            try:
                limit = min(500, max(1, int(qs.get("limit", ["100"])[0])))
            except ValueError:
                limit = 100
            with LOCK, connect() as db:
                seed_patient(db, patient_id)
                rows = db.execute(
                    "SELECT * FROM readings WHERE patient_id = ? ORDER BY id DESC LIMIT ?",
                    (patient_id, limit),
                ).fetchall()
            values = [dict(r) for r in reversed(rows)]
            latest = values[-1] if values else None
            result = {
                "patient_id": patient_id,
                "readings": values,
                "latest": latest,
                "risk": risk_for(latest["heart_rate"], latest["spo2"], latest["temperature"]) if latest else None,
            }
            return self.send_json(result)
        return self.serve_static(path)

    def do_POST(self):
        path = urlparse(self.path).path
        if path != "/api/readings":
            return self.send_json({"error": "Not found"}, 404)
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size > 8192:
                return self.send_json({"error": "Request too large"}, 413)
            payload = json.loads(self.rfile.read(size))
            patient_id = str(payload.get("patient_id") or "PT-101").strip().upper()
            hr, spo2, temp = (float(payload[k]) for k in ("heart_rate", "spo2", "temperature"))
            if not (20 <= hr <= 250 and 0 <= spo2 <= 100 and 20 <= temp <= 50):
                raise ValueError("Values outside accepted sensor bounds")
            stamp = payload.get("timestamp") or datetime.now(timezone.utc).isoformat()
            datetime.fromisoformat(stamp.replace("Z", "+00:00"))
            source = "demo" if payload.get("source") == "demo" else "device"
            with LOCK, connect() as db:
                cur = db.execute(
                    "INSERT INTO readings(patient_id,timestamp,heart_rate,spo2,temperature,source) VALUES(?,?,?,?,?,?)",
                    (patient_id, stamp, hr, spo2, temp, source),
                )
                reading = {
                    "id": cur.lastrowid,
                    "patient_id": patient_id,
                    "timestamp": stamp,
                    "heart_rate": hr,
                    "spo2": spo2,
                    "temperature": temp,
                    "source": source,
                }
            risk = risk_for(hr, spo2, temp)
            return self.send_json({"reading": reading, "risk": risk}, 201)
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
            return self.send_json({"error": str(exc)}, 400)

    def serve_static(self, path):
        name = "index.html" if path in ("/", "") else path.lstrip("/")
        target = (ROOT / "static" / name).resolve()
        if ROOT.joinpath("static").resolve() not in target.parents or not target.is_file():
            return self.send_json({"error": "Not found"}, 404)
        content_type = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
        }.get(target.suffix, "application/octet-stream")
        data = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    init_db()
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    print(f"ML Model loaded: {ML_MODEL is not None}")
    print(f"Health monitoring prototype at http://{host}:{port}")
    ThreadingHTTPServer((host, port), Handler).serve_forever()