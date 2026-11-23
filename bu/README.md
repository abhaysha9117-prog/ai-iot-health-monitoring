# Pulsepoint Health Monitor

A runnable software prototype based on the project proposal. It provides a single-patient dashboard for heart rate, SpO₂, temperature, trends, prototype risk scoring, and threshold alerts. Demo readings run by default. A JSON API is ready to accept ESP32 readings when hardware integration begins.

## Run locally

Requires Python 3. No third-party packages are needed.

```powershell
python server.py
```

Open http://127.0.0.1:8000. The app creates `health_data.sqlite3` next to `server.py` and seeds a small demo history on first run. The dashboard adds a demo reading every eight seconds. Use the **Presentation demo** buttons to load normal, needs-attention, and high-risk scenarios; selecting one pauses the live demo stream so the result stays on screen. Turn **Demo data** back on to resume the stream.

## Send a device reading

POST JSON to `http://127.0.0.1:8000/api/readings`:

```json
{
  "heart_rate": 76,
  "spo2": 98.0,
  "temperature": 36.7,
  "timestamp": "2026-11-21T12:00:00Z"
}
```

`timestamp` is optional; if omitted, the server uses its current UTC time. Accepted fields are `heart_rate` (20–250 bpm), `spo2` (0–100%), and `temperature` (20–50 °C). Successful records are saved in SQLite. Read the latest history from `GET /api/readings?limit=100`; check server availability at `GET /api/health`.

## Current scope and next steps

- **Built now:** responsive web dashboard, local persistence, demo stream and presentation scenarios, JSON ingestion endpoint, recent trends, threshold alerts that appear in the dashboard, and explainable prototype risk score.
- **Later IoT work:** ESP32 firmware, MAX30102 and temperature sensor wiring/calibration, Wi-Fi setup, device identity and authentication, and end-to-end measurement validation.
- **Later ML work:** choose an appropriate labeled dataset, document its limitations, train and evaluate a supervised model, and replace the prototype rules only after validation.

The risk score uses simple thresholds for software demonstration. It is not a trained model, clinical advice, a medical device, or an emergency alert service. Never rely on it for care decisions. The local demo server is unauthenticated and should not be exposed to the public internet or receive identifiable health data.
