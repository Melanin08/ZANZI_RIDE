from datetime import datetime, timezone
import json
import os
import sqlite3
import time
import secrets
import hashlib
from werkzeug.security import generate_password_hash, check_password_hash
from queue import Queue
from contextlib import contextmanager

from flask import Flask, Response, jsonify, request, send_from_directory
from flask_cors import CORS

CLIENT_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "client", "dist"))
app = Flask(__name__, static_folder=CLIENT_DIST, static_url_path="/static")
CORS(app)

event_subscribers = set()
VALID_STATUSES = {"searching", "accepted", "in_progress", "completed", "cancelled"}
DATABASE_PATH = os.getenv("DATABASE_PATH", os.path.join(os.path.dirname(__file__), "zinzi.db"))


@contextmanager
def get_db():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    try:
        with connection:
            yield connection
    finally:
        connection.close()


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
                created_at TEXT NOT NULL,
                driver_id TEXT,
                driver_name TEXT,
                vehicle_plate TEXT,
                eta_minutes INTEGER
            )
        """)
        connection.execute("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL)")
        connection.execute("CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL)")
        columns = {row["name"] for row in connection.execute("PRAGMA table_info(rides)")}
        for name, definition in {
            "user_id": "TEXT",
            "driver_id": "TEXT",
            "driver_name": "TEXT",
            "vehicle_plate": "TEXT",
            "eta_minutes": "INTEGER",
        }.items():
            if name not in columns:
                connection.execute(f"ALTER TABLE rides ADD COLUMN {name} {definition}")


init_db()


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
        "driverId": row["driver_id"],
        "driverName": row["driver_name"],
        "vehiclePlate": row["vehicle_plate"],
        "etaMinutes": row["eta_minutes"],
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


def current_user():
    token = request.cookies.get("zanzi_session", "")
    with get_db() as connection:
        return connection.execute(
            "SELECT users.id, users.name, users.email FROM sessions JOIN users ON users.id = sessions.user_id WHERE token_hash = ? AND expires_at > ?",
            (hashlib.sha256(token.encode()).hexdigest(), int(time.time())),
        ).fetchone() if token else None


def session_response(user, status=200):
    token = secrets.token_urlsafe(48)
    max_age = 10 * 365 * 24 * 60 * 60
    with get_db() as connection:
        connection.execute("INSERT INTO sessions VALUES (?, ?, ?)", (hashlib.sha256(token.encode()).hexdigest(), user["id"], int(time.time()) + max_age))
    response = jsonify({"user": {key: user[key] for key in ("id", "name", "email")}})
    response.set_cookie("zanzi_session", token, max_age=max_age, httponly=True, secure=request.is_secure or os.getenv("COOKIE_SECURE") == "1", samesite="Lax")
    return response, status


@app.post("/api/auth/register")
def register():
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name", "")).strip()
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))
    if not name or "@" not in email or len(password) < 8:
        return jsonify({"error": "Enter your name, a valid email, and a password of at least 8 characters."}), 400
    user = {"id": secrets.token_hex(16), "name": name, "email": email}
    try:
        with get_db() as connection:
            connection.execute("INSERT INTO users VALUES (?, ?, ?, ?)", (user["id"], name, email, generate_password_hash(password)))
    except sqlite3.IntegrityError:
        return jsonify({"error": "This email is already registered. Please sign in."}), 409
    return session_response(user, 201)


@app.post("/api/auth/login")
def login():
    payload = request.get_json(silent=True) or {}
    with get_db() as connection:
        user = connection.execute("SELECT * FROM users WHERE email = ?", (str(payload.get("email", "")).strip().lower(),)).fetchone()
    if user is None or not check_password_hash(user["password_hash"], str(payload.get("password", ""))):
        return jsonify({"error": "Email or password is incorrect."}), 401
    return session_response(user)


@app.get("/api/auth/session")
def session():
    user = current_user()
    return jsonify({"user": dict(user) if user else None})


@app.post("/api/auth/logout")
def logout():
    token = request.cookies.get("zanzi_session", "")
    with get_db() as connection:
        connection.execute("DELETE FROM sessions WHERE token_hash = ?", (hashlib.sha256(token.encode()).hexdigest(),))
    response = jsonify({"ok": True})
    response.delete_cookie("zanzi_session")
    return response


@app.get("/api/auth/rides")
def my_rides():
    user = current_user()
    if user is None:
        return jsonify({"error": "Please sign in."}), 401
    with get_db() as connection:
        rows = connection.execute("SELECT * FROM rides WHERE user_id = ? ORDER BY created_at DESC", (user["id"],)).fetchall()
    return jsonify({"data": [serialize_ride(row) for row in rows]})


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "service": "zanzi-ride-api", "timestamp": now_iso()})


@app.get("/api/events")
def events():
    def stream():
        subscriber = Queue()
        event_subscribers.add(subscriber)
        try:
            yield "event: connected\ndata: {\"service\": \"zanzi-ride-api\"}\n\n"
            while True:
                event = subscriber.get()
                yield f"event: {event['type']}\ndata: {json.dumps(event['data'])}\n\n"
        finally:
            event_subscribers.discard(subscriber)

    return Response(
        stream(),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


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
            "INSERT INTO rides (id, pickup, destination, vehicle, payment_method, status, estimated_fare, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                ride["id"],
                ride["pickup"],
                ride["destination"],
                ride["vehicle"],
                ride["paymentMethod"],
                ride["status"],
                ride["estimatedFare"],
                ride["createdAt"],
            ),
        )

    user = current_user()
    if user:
        with get_db() as connection:
            connection.execute("UPDATE rides SET user_id = ? WHERE id = ?", (user["id"], ride["id"]))
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


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def client(path):
    requested_file = os.path.join(app.static_folder, path)
    if path and os.path.isfile(requested_file):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    init_db()
    port = int(os.getenv("PORT", "4000"))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG") == "1")
