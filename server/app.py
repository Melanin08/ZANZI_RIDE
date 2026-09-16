from datetime import datetime, timezone
import json
import os
import sqlite3
from queue import Queue
import time

from flask import Flask, Response, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

DRIVERS = [
    {"id": "driver-001", "name": "Driver 001", "place": "Stone Town", "initials": "AM", "color": "#e4b84a", "status": "On trip", "online": True, "tripsToday": 6},
    {"id": "driver-002", "name": "Driver 002", "place": "Airport", "initials": "SH", "color": "#e8795d", "status": "Available", "online": True, "tripsToday": 4},
    {"id": "driver-003", "name": "Driver 003", "place": "Nungwi", "initials": "HM", "color": "#4e9c88", "status": "Available", "online": True, "tripsToday": 8},
]

event_subscribers = set()
VALID_STATUSES = {"searching", "accepted", "in_progress", "completed", "cancelled"}
DATABASE_PATH = os.path.join(os.path.dirname(__file__), "zinzi.db")


def get_db():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    with get_db() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS rides (
                id TEXT PRIMARY KEY,
                pickup TEXT NOT NULL,
                destination TEXT NOT NULL,
                vehicle TEXT NOT NULL,
                payment_method TEXT NOT NULL,
                status TEXT NOT NULL,
                estimated_fare TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)


def serialize_ride(row):
    return {
        "id": row["id"],
        "pickup": row["pickup"],
        "destination": row["destination"],
        "vehicle": row["vehicle"],
        "paymentMethod": row["payment_method"],
        "status": row["status"],
        "estimatedFare": row["estimated_fare"],
        "createdAt": row["created_at"],
    }


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def estimate_fare(vehicle):
    fares = {
        "Boda": "TSh 2,000 - 4,000",
        "XL": "TSh 12,000 - 16,000",
        "Comfort": "TSh 8,500 - 11,000",
    }
    return fares.get(vehicle, fares["Comfort"])


def publish_event(event):
    for subscriber in list(event_subscribers):
        subscriber.put(event)


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "service": "zinzi-ride-api", "timestamp": now_iso()})


@app.get("/api/drivers")
def get_drivers():
    return jsonify({"data": DRIVERS})


@app.get("/api/events")
def events():
    def stream():
        subscriber = Queue()
        event_subscribers.add(subscriber)
        try:
            yield "event: connected\ndata: {\"service\": \"zinzi-ride-api\"}\n\n"
            while True:
                event = subscriber.get()
                yield f"event: {event['type']}\ndata: {json.dumps(event['data'])}\n\n"
        finally:
            event_subscribers.discard(subscriber)

    return Response(stream(), mimetype="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/api/dashboard")
def get_dashboard():
    return jsonify({
        "data": {
            "grossRevenue": "TSh 4.82M",
            "activeTrips": 38,
            "driversOnline": 126,
            "totalDrivers": 284,
            "commission": "TSh 724K",
            "drivers": DRIVERS,
            "activity": [
                {"type": "ride", "title": "Trip started", "detail": "Driver 014 · Kisauni → Mbweni", "time": "2m"},
                {"type": "money", "title": "Payment received", "detail": "Trip #ZR-2048 · Cash", "time": "4m"},
                {"type": "alert", "title": "Driver verification", "detail": "3 documents need review", "time": "8m"},
                {"type": "user", "title": "New passenger signup", "detail": "Amir Juma · Zanzibar City", "time": "12m"},
            ],
        }
    })


@app.post("/api/rides")
def create_ride():
    payload = request.get_json(silent=True) or {}
    pickup = payload.get("pickup")
    destination = payload.get("destination")
    vehicle = payload.get("vehicle", "Comfort")
    payment_method = payload.get("paymentMethod", "cash")

    if not pickup or not destination:
        return jsonify({"error": "pickup and destination are required"}), 400

    ride = {
        "id": f"ride-{int(time.time() * 1000)}",
        "pickup": pickup,
        "destination": destination,
        "vehicle": vehicle,
        "paymentMethod": payment_method,
        "status": "searching",
        "estimatedFare": estimate_fare(vehicle),
        "createdAt": now_iso(),
    }
    with get_db() as connection:
        connection.execute(
            "INSERT INTO rides VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (ride["id"], ride["pickup"], ride["destination"], ride["vehicle"], ride["paymentMethod"], ride["status"], ride["estimatedFare"], ride["createdAt"]),
        )
    publish_event({"type": "ride.created", "data": ride})
    return jsonify({"data": ride}), 201


@app.get("/api/rides")
def get_rides():
    with get_db() as connection:
        rows = connection.execute("SELECT * FROM rides ORDER BY created_at DESC").fetchall()
    return jsonify({"data": [serialize_ride(row) for row in rows]})


@app.patch("/api/rides/<ride_id>/status")
def update_ride_status(ride_id):
    with get_db() as connection:
        row = connection.execute("SELECT * FROM rides WHERE id = ?", (ride_id,)).fetchone()
    if row is None:
        return jsonify({"error": "ride not found"}), 404

    payload = request.get_json(silent=True) or {}
    status = payload.get("status")
    if status not in VALID_STATUSES:
        return jsonify({"error": "invalid ride status"}), 400

    with get_db() as connection:
        connection.execute("UPDATE rides SET status = ? WHERE id = ?", (status, ride_id))
        updated_row = connection.execute("SELECT * FROM rides WHERE id = ?", (ride_id,)).fetchone()
    ride = serialize_ride(updated_row)
    publish_event({"type": "ride.updated", "data": ride})
    return jsonify({"data": ride})


if __name__ == "__main__":
    init_db()
    port = int(os.getenv("PORT", "4000"))
    app.run(host="0.0.0.0", port=port, debug=True)
