"""Small, dependency-free health monitoring demo server.

This prototype is for software development and demonstration only. It is not
intended for diagnosis, treatment, or emergency response.
"""
from __future__ import annotations

import json
import os
import sqlite3
import threading
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("HEALTH_DB", ROOT / "health_data.sqlite3"))
LOCK = threading.Lock()


def risk_for(hr: float, spo2: float, temp: float) -> dict:
    """Explainable prototype scoring; thresholds require clinical review."""
    score, reasons = 0, []
    if hr < 50 or hr > 120:
        score += 38
        reasons.append("Heart rate outside the prototype range")
    elif hr < 60 or hr > 100:
        score += 16
        reasons.append("Heart rate outside the reference range")
    if spo2 < 90:
        score += 48
        reasons.append("SpO₂ below 90%")
    elif spo2 < 95:
        score += 22
        reasons.append("SpO₂ below 95%")
    if temp >= 39 or temp < 35:
        score += 38
        reasons.append("Temperature outside the prototype range")
    elif temp >= 38 or temp < 36:
        score += 18
        reasons.append("Temperature outside the reference range")
    score = min(score, 100)
    level = "High" if score >= 45 else "Moderate" if score >= 18 else "Low"
    return {"score": score, "level": level, "reasons": reasons or ["No prototype threshold crossed"]}


def connect():
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    return db


def init_db():
    with connect() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT NOT NULL,
            heart_rate REAL NOT NULL, spo2 REAL NOT NULL, temperature REAL NOT NULL,
            source TEXT NOT NULL DEFAULT 'device')""")
        if db.execute("SELECT COUNT(*) FROM readings").fetchone()[0] == 0:
            now = datetime.now(timezone.utc)
            for i in range(24):
                t = now - timedelta(minutes=(23-i)*5)
                hr = 72 + (i % 7) * 2 + (3 if i % 5 == 0 else 0)
                spo2 = 97 + (i % 3)
                temp = 36.5 + (i % 4) * .1
                db.execute("INSERT INTO readings(timestamp,heart_rate,spo2,temperature,source) VALUES(?,?,?,?,?)",
                           (t.isoformat(), hr, spo2, temp, "demo"))
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
        path = urlparse(self.path).path
        if path == "/api/health":
            return self.send_json({"status": "ok", "mode": "prototype", "risk_model": "transparent prototype rules"})
        if path == "/api/readings":
            try:
                limit = min(500, max(1, int(urlparse(self.path).query.split("limit=")[-1].split("&")[0]))) if "limit=" in self.path else 100
            except ValueError:
                limit = 100
            with connect() as db:
                rows = db.execute("SELECT * FROM readings ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
            values = [dict(r) for r in reversed(rows)]
            latest = values[-1] if values else None
            result = {"readings": values, "latest": latest,
                      "risk": risk_for(latest["heart_rate"], latest["spo2"], latest["temperature"]) if latest else None}
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
            hr, spo2, temp = (float(payload[k]) for k in ("heart_rate", "spo2", "temperature"))
            if not (20 <= hr <= 250 and 0 <= spo2 <= 100 and 20 <= temp <= 50):
                raise ValueError("Values outside accepted sensor bounds")
            stamp = payload.get("timestamp") or datetime.now(timezone.utc).isoformat()
            datetime.fromisoformat(stamp.replace("Z", "+00:00"))
            source = "demo" if payload.get("source") == "demo" else "device"
            with LOCK, connect() as db:
                cur = db.execute("INSERT INTO readings(timestamp,heart_rate,spo2,temperature,source) VALUES(?,?,?,?,?)",
                                 (stamp, hr, spo2, temp, source))
                reading = {"id": cur.lastrowid, "timestamp": stamp, "heart_rate": hr,
                           "spo2": spo2, "temperature": temp, "source": source}
            risk = risk_for(hr, spo2, temp)
            return self.send_json({"reading": reading, "risk": risk}, 201)
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
            return self.send_json({"error": str(exc)}, 400)

    def serve_static(self, path):
        name = "index.html" if path in ("/", "") else path.lstrip("/")
        target = (ROOT / "static" / name).resolve()
        if ROOT.joinpath("static").resolve() not in target.parents or not target.is_file():
            return self.send_json({"error": "Not found"}, 404)
        content_type = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8"}.get(target.suffix, "application/octet-stream")
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
    print(f"Health monitoring prototype at http://{host}:{port}")
    ThreadingHTTPServer((host, port), Handler).serve_forever()
