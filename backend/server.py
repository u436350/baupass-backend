import os
import sqlite3
import secrets
import csv
import io
import json
import smtplib
import ipaddress
import html
import socket
import re
import threading
import time
from functools import wraps
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from pathlib import Path
from email.message import EmailMessage
from urllib.parse import quote, urlsplit, urlunsplit
from flask import Flask, jsonify, request, send_from_directory, g, Response, redirect, has_request_context
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.middleware.proxy_fix import ProxyFix
import pyotp
import qrcode

BASE_DIR = Path(__file__).resolve().parent.parent

# ──────────────────────────────────────────────
# PWA-Icon-Generierung (PNG, einmalig gecacht)
# ──────────────────────────────────────────────
_icon_png_cache: dict[int, bytes] = {}


def _generate_icon_png(size: int) -> bytes:
    """Erzeugt ein PNG-Icon (size×size) mit Baupass-Branding."""
    if size in _icon_png_cache:
        return _icon_png_cache[size]

    from PIL import Image, ImageDraw, ImageFont
    import io as _io

    r1, g1, b1 = 217, 93, 57    # #d95d39 (orange)
    r2, g2, b2 = 18, 20, 23     # #121417 (dunkel)
    radius = max(4, size // 6)
    denom = max(1, 2 * (size - 1))

    try:
        import numpy as np
        yi, xi = np.mgrid[0:size, 0:size]
        t = (xi + yi) / denom
        arr = np.zeros((size, size, 4), dtype=np.uint8)
        arr[:, :, 0] = np.clip(r1 + (r2 - r1) * t, 0, 255).astype(np.uint8)
        arr[:, :, 1] = np.clip(g1 + (g2 - g1) * t, 0, 255).astype(np.uint8)
        arr[:, :, 2] = np.clip(b1 + (b2 - b1) * t, 0, 255).astype(np.uint8)
        arr[:, :, 3] = 255
        img_raw = Image.fromarray(arr, "RGBA")
    except ImportError:
        pixels = bytearray(size * size * 4)
        idx = 0
        for y in range(size):
            for x in range(size):
                tn = x + y
                pixels[idx]     = r1 + (r2 - r1) * tn // denom
                pixels[idx + 1] = g1 + (g2 - g1) * tn // denom
                pixels[idx + 2] = b1 + (b2 - b1) * tn // denom
                pixels[idx + 3] = 255
                idx += 4
        img_raw = Image.frombytes("RGBA", (size, size), bytes(pixels))

    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    result = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    result.paste(img_raw, mask=mask)

    draw = ImageDraw.Draw(result)
    text = "BP"
    font_size = size // 3
    font = None
    for fp in ["arialbd.ttf", "arial.ttf", "DejaVuSans-Bold.ttf",
               "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
               "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"]:
        try:
            font = ImageFont.truetype(fp, font_size)
            break
        except Exception:
            pass
    if font is None:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((size - tw) // 2 - bbox[0], (size - th) // 2 - bbox[1]),
              text, fill=(255, 247, 239, 255), font=font)

    buf = _io.BytesIO()
    result.save(buf, "PNG")
    data = buf.getvalue()
    _icon_png_cache[size] = data
    return data
DB_PATH = BASE_DIR / "backend" / "baupass.db"

app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)


def get_cors_origins():
    origins = [
        "http://127.0.0.1:8080",
        "http://localhost:8080",
        "https://saa-s-flow--mahmodscharif12.replit.app",
        re.compile(r"^https://[a-z0-9-]+\.github\.io$"),
        re.compile(r"^https://[a-z0-9-]+\.onrender\.com$"),
    ]
    extra_origins = [item.strip() for item in (os.getenv("BAUPASS_CORS_ORIGINS") or "").split(",") if item.strip()]
    return origins + extra_origins

@app.route("/user/<id>")
def user(id):
    return f"Baustellenausweis für User {id}"

from flask_cors import CORS
# CORS mit erlaubten Origins und Credentials aktivieren (kein Wildcard!)
CORS(app, supports_credentials=True, origins=get_cors_origins())

SESSION_TTL_HOURS = 12
LOGIN_MAX_ATTEMPTS = 5
LOGIN_LOCK_MINUTES = 10
SESSION_COOKIE_NAME = "baupass_session"
failed_login_attempts = {}

PLAN_NET_PRICE_EUR = {
    "tageskarte": 19.0,
    "starter": 49.0,
    "professional": 99.0,
    "enterprise": 199.0,
}

AUTO_SUSPEND_GRACE_DAYS = 3
APP_STARTED_AT = datetime.utcnow()
DUNNING_LAST_RUN_AT = None
DUNNING_LAST_RESULT = {"remindersSent": 0, "reminderFailures": 0, "overdueUpdated": 0, "suspendedCompanies": 0}
BACKUP_RETENTION_DAYS = max(1, int(os.getenv("BAUPASS_BACKUP_RETENTION_DAYS", "30")))
ALERT_DEDUP_MINUTES = max(5, int(os.getenv("BAUPASS_ALERT_DEDUP_MINUTES", "30")))

REQUEST_RATE_LIMITS = {
    "import": {"max": 10, "window_seconds": 60},
    "login": {"max": 30, "window_seconds": 60},
    "worker_login": {"max": 30, "window_seconds": 60},
}
request_rate_state = {}
_rate_lock = threading.Lock()

_background_started = False
_background_lock = threading.Lock()


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def now_iso():
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def parse_iso_date(value):
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return datetime.strptime(raw[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def get_rate_limit_key(scope):
    return f"{scope}|{get_client_ip()}"


def check_rate_limit(scope):
    rule = REQUEST_RATE_LIMITS.get(scope)
    if not rule:
        return True, 0

    now_ts = time.time()
    key = get_rate_limit_key(scope)
    with _rate_lock:
        state = request_rate_state.get(key)
        if not state:
            request_rate_state[key] = {"count": 1, "window_start": now_ts}
            return True, 0

        elapsed = now_ts - float(state.get("window_start", now_ts))
        if elapsed >= rule["window_seconds"]:
            request_rate_state[key] = {"count": 1, "window_start": now_ts}
            return True, 0

        state["count"] = int(state.get("count", 0)) + 1
        if state["count"] > rule["max"]:
            retry_after = max(1, int(rule["window_seconds"] - elapsed))
            return False, retry_after

        return True, 0


def require_rate_limit(scope):
    def decorator(handler):
        @wraps(handler)
        def wrapper(*args, **kwargs):
            allowed, retry_after = check_rate_limit(scope)
            if not allowed:
                return jsonify({"error": "rate_limited", "retryAfterSeconds": retry_after}), 429
            return handler(*args, **kwargs)

        return wrapper

    return decorator


def expiry_iso(hours=SESSION_TTL_HOURS):
    return (datetime.utcnow() + timedelta(hours=hours)).replace(microsecond=0).isoformat() + "Z"


def _next_local_midnight_utc():
    timezone_name = os.getenv("BAUPASS_TIMEZONE", "Europe/Berlin")
    try:
        local_tz = ZoneInfo(timezone_name)
    except Exception:
        local_tz = timezone.utc

    local_now = datetime.now(local_tz)
    return (local_now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)


def worker_session_expiry_iso():
    # Worker app sessions are daily cards and expire at next local midnight.
    next_midnight_utc = _next_local_midnight_utc().replace(microsecond=0)
    return next_midnight_utc.replace(tzinfo=None).isoformat() + "Z"


def worker_access_token_expiry_iso():
    # Visitor-card link expires after a short window, but never later than local midnight.
    max_hours = max(1, int(os.getenv("BAUPASS_VISITOR_LINK_HOURS", "12")))
    now_utc = datetime.now(timezone.utc)
    by_hours_utc = now_utc + timedelta(hours=max_hours)
    expires_utc = min(by_hours_utc, _next_local_midnight_utc()).replace(microsecond=0)
    return expires_utc.replace(tzinfo=None).isoformat() + "Z"


def resolve_worker_session_expiry_iso(worker):
    session_end = parse_iso_utc(worker_session_expiry_iso())
    visit_end = resolve_worker_access_end_utc(worker)
    if visit_end and visit_end < session_end:
        return visit_end.astimezone(timezone.utc).replace(tzinfo=None, microsecond=0).isoformat() + "Z"
    return session_end.astimezone(timezone.utc).replace(tzinfo=None, microsecond=0).isoformat() + "Z"


def resolve_worker_access_token_expiry_iso(worker):
    link_end = parse_iso_utc(worker_access_token_expiry_iso())
    visit_end = resolve_worker_access_end_utc(worker)
    if visit_end and visit_end < link_end:
        return visit_end.astimezone(timezone.utc).replace(tzinfo=None, microsecond=0).isoformat() + "Z"
    return link_end.astimezone(timezone.utc).replace(tzinfo=None, microsecond=0).isoformat() + "Z"


def purge_expired_worker_app_sessions(db, now_value=None):
    timestamp = now_value or now_iso()
    result = db.execute("DELETE FROM worker_app_sessions WHERE expires_at < ?", (timestamp,))
    return int(result.rowcount or 0)


def normalize_company_plan(plan_value):
    plan = str(plan_value or "").strip().lower()
    return plan if plan in PLAN_NET_PRICE_EUR else "tageskarte"


def normalize_worker_type(worker_type):
    normalized = str(worker_type or "worker").strip().lower()
    return normalized if normalized in {"worker", "visitor"} else "worker"


def parse_date_start(value):
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.strptime(text, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def parse_datetime_local_to_utc_iso(value):
    text = str(value or "").strip()
    if not text:
        return ""
    timezone_name = os.getenv("BAUPASS_TIMEZONE", "Europe/Berlin")
    try:
        local_tz = ZoneInfo(timezone_name)
    except Exception:
        local_tz = timezone.utc
    try:
        local_dt = datetime.strptime(text, "%Y-%m-%dT%H:%M")
    except ValueError:
        try:
            parsed = parse_iso_utc(text)
            if not parsed:
                return ""
            return parsed.astimezone(timezone.utc).replace(tzinfo=None, microsecond=0).isoformat() + "Z"
        except Exception:
            return ""
    localized = local_dt.replace(tzinfo=local_tz)
    as_utc = localized.astimezone(timezone.utc).replace(tzinfo=None, microsecond=0)
    return as_utc.isoformat() + "Z"


def serialize_worker_record(row):
    return {
        "id": row["id"],
        "companyId": row["company_id"],
        "subcompanyId": row["subcompany_id"],
        "firstName": row["first_name"],
        "lastName": row["last_name"],
        "insuranceNumber": row["insurance_number"],
        "workerType": normalize_worker_type(row["worker_type"]),
        "role": row["role"],
        "site": row["site"],
        "validUntil": row["valid_until"],
        "visitorCompany": row["visitor_company"],
        "visitPurpose": row["visit_purpose"],
        "hostName": row["host_name"],
        "visitEndAt": row["visit_end_at"],
        "status": row["status"],
        "photoData": row["photo_data"],
        "badgeId": row["badge_id"],
        "badgePinConfigured": bool(row["badge_pin_hash"]),
        "physicalCardId": row["physical_card_id"],
        "deletedAt": row["deleted_at"],
    }


def resolve_worker_access_end_utc(worker):
    worker_type = normalize_worker_type(worker["worker_type"] if isinstance(worker, sqlite3.Row) else worker.get("worker_type") or worker.get("workerType"))
    visit_end_at = worker["visit_end_at"] if isinstance(worker, sqlite3.Row) else worker.get("visit_end_at", worker.get("visitEndAt", ""))
    valid_until = worker["valid_until"] if isinstance(worker, sqlite3.Row) else worker.get("valid_until", worker.get("validUntil", ""))
    if worker_type != "visitor":
        return None
    visit_end_dt = parse_iso_utc(visit_end_at)
    if visit_end_dt:
        return visit_end_dt.astimezone(timezone.utc)
    valid_until_dt = parse_date_start(valid_until)
    if valid_until_dt:
        return valid_until_dt.replace(hour=23, minute=59, second=59)
    return None


def worker_visit_has_expired(worker, reference_dt=None):
    access_end = resolve_worker_access_end_utc(worker)
    if not access_end:
        return False
    now_dt = reference_dt or datetime.now(timezone.utc)
    return access_end <= now_dt


def calculate_net_amount_by_plan(company_plan, payload_net_amount):
    # Keep manual values from UI, but provide a predictable fallback for tariff-based billing.
    explicit_net = float(payload_net_amount or 0)
    if explicit_net > 0:
        return round(explicit_net, 2)
    normalized_plan = normalize_company_plan(company_plan)
    return PLAN_NET_PRICE_EUR[normalized_plan]


@app.after_request
def apply_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "same-origin"
    path = (request.path or "").lower()
    is_pwa_asset = (
        path in {
            "/worker.html",
            "/worker.css",
            "/worker-app.js",
            "/worker-manifest.json",
            "/worker-sw.js",
            "/worker-icon-192.png",
            "/worker-icon-512.png",
            "/worker-icon-192.svg",
            "/worker-icon-512.svg",
        }
        or path.startswith("/worker-icon-")
    )

    if path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
        response.headers["Pragma"] = "no-cache"
    elif is_pwa_asset:
        response.headers["Cache-Control"] = "public, max-age=3600"
        response.headers.pop("Pragma", None)
    else:
        response.headers["Cache-Control"] = "no-cache"
        response.headers["Pragma"] = "no-cache"
    return response


def build_login_throttle_key():
    forwarded = (request.headers.get("X-Forwarded-For") or "").strip()
    client_ip = forwarded.split(",", 1)[0].strip() if forwarded else (request.remote_addr or "local")
    username = ((request.get_json(silent=True) or {}).get("username") or "").strip().lower()
    return f"{client_ip}|{username}"


def can_attempt_login(throttle_key):
    state = failed_login_attempts.get(throttle_key)
    if not state:
        return True, 0
    locked_until = state.get("locked_until")
    if not locked_until:
        return True, 0
    now = datetime.utcnow()
    if now >= locked_until:
        failed_login_attempts.pop(throttle_key, None)
        return True, 0
    remaining_seconds = int((locked_until - now).total_seconds())
    return False, max(remaining_seconds, 1)


def register_login_failure(throttle_key):
    now = datetime.utcnow()
    state = failed_login_attempts.get(throttle_key, {"count": 0, "locked_until": None})
    state["count"] = int(state.get("count", 0)) + 1
    if state["count"] >= LOGIN_MAX_ATTEMPTS:
        state["locked_until"] = now + timedelta(minutes=LOGIN_LOCK_MINUTES)
    failed_login_attempts[throttle_key] = state


def clear_login_failures(throttle_key):
    failed_login_attempts.pop(throttle_key, None)


def clear_login_failures_for_username(username):
    normalized_username = str(username or "").strip().lower()
    if not normalized_username:
        return
    keys_to_delete = [key for key in failed_login_attempts.keys() if key.endswith(f"|{normalized_username}")]
    for key in keys_to_delete:
        failed_login_attempts.pop(key, None)


def get_user_from_session_token(token_value):
    if not token_value:
        return None
    db = get_db()
    session = db.execute("SELECT user_id, expires_at FROM sessions WHERE token = ?", (token_value,)).fetchone()
    if not session:
        return None
    if session["expires_at"] < now_iso():
        db.execute("DELETE FROM sessions WHERE token = ?", (token_value,))
        db.commit()
        return None
    user = db.execute("SELECT * FROM users WHERE id = ?", (session["user_id"],)).fetchone()
    return row_to_dict(user) if user else None


def render_login_page():
    db = get_db()
    settings_row = db.execute("SELECT invoice_logo_data, platform_name, operator_name, turnstile_endpoint FROM settings WHERE id = 1").fetchone()
    logo_src = ""
    platform_name = "BauPass Control"
    operator_name = "Deine Betriebsfirma"
    turnstile_endpoint = "Noch nicht gesetzt"
    if settings_row:
        logo_src = (settings_row["invoice_logo_data"] or "").strip()
        platform_name = settings_row["platform_name"] or platform_name
        operator_name = settings_row["operator_name"] or operator_name
        turnstile_endpoint = (settings_row["turnstile_endpoint"] or "").strip() or turnstile_endpoint

    if not logo_src:
        fallback_logo = BASE_DIR / "branding" / "baukometra-logo.svg"
        if fallback_logo.exists():
            svg = fallback_logo.read_text(encoding="utf-8")
            logo_src = f"data:image/svg+xml;charset=utf-8,{quote(svg)}"
        else:
            logo_src = "/branding/baukometra-logo.svg"

    fallback_svg = '<svg xmlns="http://www.w3.org/2000/svg" width="210" height="84" viewBox="0 0 210 84"><rect width="210" height="84" rx="12" fill="#0f4c5c"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="32" font-weight="700" fill="white">BK</text></svg>'
    fallback_data = f"data:image/svg+xml;charset=utf-8,{quote(fallback_svg)}"

    template = """
        <!DOCTYPE html>
        <html lang="de">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate, max-age=0" />
            <meta http-equiv="Pragma" content="no-cache" />
            <meta http-equiv="Expires" content="0" />
            <title>__PLATFORM__ Login</title>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
            <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
            <link rel="stylesheet" href="/styles.css" />
            <style>
                body.auth-locked {
                    display: block;
                }
                .server-auth-shell {
                    min-height: 100vh;
                }
                .server-auth-shell .auth-overlay {
                    padding: 16px;
                }
                .server-auth-shell .auth-panel {
                    width: min(100%, 560px);
                    max-height: calc(100vh - 32px);
                    overflow: auto;
                }
                .server-auth-shell .auth-form {
                    gap: 10px;
                }
                .server-auth-shell .server-auth-submit {
                    position: sticky;
                    bottom: 0;
                    z-index: 2;
                    margin-top: 6px;
                    box-shadow: 0 -10px 18px rgba(255, 252, 246, 0.94);
                }
                .server-auth-shell .auth-form label {
                    gap: 5px;
                }
                .server-auth-shell .auth-form input {
                    padding: 10px 12px;
                }
                .server-auth-shell .auth-system-grid {
                    margin-top: 10px;
                    gap: 8px;
                }
                .server-auth-shell .meta-box {
                    padding: 12px;
                }
                .server-auth-error {
                    display: none;
                    margin: 0;
                    padding: 10px 12px;
                    border-radius: 12px;
                    color: #8a1f1f;
                    background: rgba(197, 61, 47, 0.16);
                    border: 1px solid rgba(197, 61, 47, 0.3);
                    font-weight: 600;
                }
                @media (max-height: 820px) {
                    .server-auth-shell .auth-panel {
                        gap: 12px;
                        padding: 20px;
                    }
                    .server-auth-shell .auth-copy {
                        margin-top: 6px;
                        line-height: 1.45;
                    }
                    .server-auth-shell .auth-hints {
                        display: none;
                    }
                }
            </style>
        </head>
        <body class="auth-locked">
            <div class="server-auth-shell">
                <div id="authOverlay" class="auth-overlay active" style="display:grid; position:relative; inset:auto; min-height:100vh;">
                    <div class="auth-panel">
                        <div>
                            <img class="website-logo-sync website-logo website-logo-auth" src="__LOGO__" alt="Firmenlogo" onerror="this.onerror=null;this.src='__FALLBACK__'" />
                            <p class="eyebrow">Melde-Seite</p>
                            <h2>Sicher in __PLATFORM__ anmelden</h2>
                            <p class="auth-copy">Super-Admin behaelt die Systemhoheit. Firmen-Admins sehen nur ihre Firma. Der Drehkreuz-Login bekommt einen schnellen Zutrittsmodus.</p>
                            <div class="auth-system-grid">
                                <article class="auth-system-card">
                                    <span>Plattform</span>
                                    <strong id="loginPlatformName">__PLATFORM__</strong>
                                </article>
                                <article class="auth-system-card">
                                    <span>Betreiber</span>
                                    <strong id="loginOperatorName">__OPERATOR__</strong>
                                </article>
                                <article class="auth-system-card full-width">
                                    <span>Drehkreuz-Endpunkt</span>
                                    <strong id="loginTurnstileEndpoint">__TURNSTILE__</strong>
                                </article>
                            </div>
                        </div>

                        <p id="errorBox" class="server-auth-error"></p>
                        <form id="f" class="auth-form" novalidate>
                            <label>
                                Benutzername
                                <input id="u" required />
                            </label>
                            <label>
                                Passwort
                                <input id="p" type="password" required />
                            </label>
                            <label>
                                OTP-Code (wenn 2FA aktiv)
                                <input id="o" />
                            </label>
                            <label>
                                Zugangstyp
                                <select id="s">
                                    <option value="auto">Automatisch</option>
                                    <option value="server-admin">Server-Admin</option>
                                    <option value="company-admin">Firmen-Admin</option>
                                    <option value="turnstile">Drehkreuz</option>
                                </select>
                            </label>
                            <button type="submit" class="primary-button server-auth-submit">Anmelden</button>
                        </form>

                        <div class="auth-hints">
                            <div class="meta-box">
                                <p>Demo-Zugaenge</p>
                                <p>Super-Admin: superadmin / 1234</p>
                                <p>Firmen-Admin: firma / 1234</p>
                                <p>Drehkreuz: drehkreuz / 1234</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <script>
                const form = document.getElementById('f');
                const errorBox = document.getElementById('errorBox');
                const showError = (msg) => {
                    errorBox.textContent = msg;
                    errorBox.style.display = 'block';
                };
                form.addEventListener('submit', async (event) => {
                    event.preventDefault();
                    errorBox.style.display = 'none';
                    let res;
                    let p = null;
                    try {
                        res = await fetch('/api/login', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                username: document.getElementById('u').value.trim(),
                                password: document.getElementById('p').value,
                                otpCode: document.getElementById('o').value.trim(),
                                loginScope: document.getElementById('s').value
                            })
                        });
                    } catch {
                        showError('Backend nicht erreichbar. Bitte Seite neu laden und Server prüfen.');
                        return;
                    }
                    p = await res.json().catch(() => ({ error: 'login_failed' }));
                    const code = (p && p.error) ? p.error : (!res.ok ? String(res.status) : '');
                    if (code) {
                        if (code === 'too_many_attempts') {
                            showError('Zu viele Fehlversuche. Bitte spaeter erneut versuchen.');
                            return;
                        }
                        if (code === 'invalid_credentials') {
                            showError('Benutzername oder Passwort ist falsch. Bitte Daten prüfen.');
                            return;
                        }
                        if (code === 'otp_required') {
                            showError('Für dieses Konto ist 2FA aktiv. Bitte OTP-Code eingeben.');
                            return;
                        }
                        if (code === 'otp_invalid') {
                            showError('OTP-Code ist ungültig oder abgelaufen. Bitte neuen Code eingeben.');
                            return;
                        }
                        if (code === 'forbidden_tenant_host') {
                            showError('Dieser Zugang ist nur über die freigegebene Firmen-Domain erlaubt.');
                            return;
                        }
                        if (code === 'admin_ip_not_allowed') {
                            showError('Admin-Zugriff von dieser IP ist nicht erlaubt.');
                            return;
                        }
                        if (code === 'login_scope_mismatch') {
                            showError('Zugangstyp passt nicht zum Konto. Bitte Server-Admin/Firmen-Admin korrekt auswählen.');
                            return;
                        }
                        showError('Login fehlgeschlagen: ' + code);
                        return;
                    }
                    if (!p || p.ok !== true || !p.token) {
                        showError('Login-Antwort unvollstaendig. Bitte erneut versuchen.');
                        return;
                    }
                    location.href = '/';
                });
            </script>
        </body>
        </html>
        """
    return (
        template
        .replace("__LOGO__", html.escape(logo_src, quote=True))
        .replace("__FALLBACK__", html.escape(fallback_data, quote=True))
        .replace("__PLATFORM__", html.escape(platform_name))
        .replace("__OPERATOR__", html.escape(operator_name))
        .replace("__TURNSTILE__", html.escape(turnstile_endpoint))
    )


def get_request_host():
    return (request.host or "").split(":", 1)[0].strip().lower()


def get_preferred_local_ip():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        return ""


def is_private_or_local_host(hostname):
    normalized = (hostname or "").strip().lower()
    if not normalized:
        return False
    if normalized in {"127.0.0.1", "localhost", "::1"}:
        return True
    try:
        ip = ipaddress.ip_address(normalized)
        return ip.is_private or ip.is_loopback
    except ValueError:
        return False


def should_force_https_links(hostname):
    # Default to HTTP on local/private networks unless explicitly enabled.
    flag = (os.getenv("BAUPASS_FORCE_HTTPS_LINKS") or "0").strip().lower()
    if flag in {"0", "false", "off", "no"}:
        return False
    return is_private_or_local_host(hostname)


def get_public_base_url():
    configured = (os.getenv("PUBLIC_BASE_URL") or os.getenv("RENDER_EXTERNAL_URL") or "").strip().rstrip("/")
    if configured:
        return configured

    if has_request_context() and request.host:
        return f"{request.scheme}://{request.host}"

    preferred_ip = get_preferred_local_ip() or "127.0.0.1"
    port = (os.getenv("PORT") or "8000").strip() or "8000"
    scheme = "https" if get_ssl_context_from_env() else "http"
    default_port = "443" if scheme == "https" else "80"
    port_suffix = "" if port == default_port else f":{port}"
    return f"{scheme}://{preferred_ip}{port_suffix}"


def should_use_cross_site_cookie():
    origin = (request.headers.get("Origin") or "").strip().rstrip("/")
    current_origin = f"{request.scheme}://{request.host}".rstrip("/")
    return bool(origin) and origin != current_origin and request.is_secure


def get_ssl_context_from_env():
    ssl_mode = (os.getenv("BAUPASS_SSL_MODE") or "").strip().lower()
    if ssl_mode in {"", "0", "false", "off", "disabled", "none"}:
        return None
    if ssl_mode in {"adhoc", "enabled", "https"}:
        return "adhoc"
    if ssl_mode == "cert":
        cert_file = (os.getenv("BAUPASS_SSL_CERT") or "").strip()
        key_file = (os.getenv("BAUPASS_SSL_KEY") or "").strip()
        if not cert_file or not key_file:
            raise RuntimeError("BAUPASS_SSL_MODE=cert requires BAUPASS_SSL_CERT and BAUPASS_SSL_KEY")
        return cert_file, key_file
    raise RuntimeError(f"Unsupported BAUPASS_SSL_MODE: {ssl_mode}")


def get_client_ip():
    forwarded = (request.headers.get("X-Forwarded-For") or "").strip()
    return forwarded.split(",", 1)[0].strip() if forwarded else (request.remote_addr or "local")


def parse_ip_whitelist(raw):
    return [item.strip() for item in (raw or "").replace(";", ",").split(",") if item.strip()]


def ip_allowed(ip_value, whitelist):
    if not whitelist:
        return True
    try:
        ip_obj = ipaddress.ip_address(ip_value)
    except ValueError:
        return False
    for rule in whitelist:
        try:
            if "/" in rule:
                if ip_obj in ipaddress.ip_network(rule, strict=False):
                    return True
            elif ip_obj == ipaddress.ip_address(rule):
                return True
        except ValueError:
            continue
    return False


def init_db():
    db = sqlite3.connect(DB_PATH)
    cur = db.cursor()
    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            platform_name TEXT NOT NULL,
            operator_name TEXT NOT NULL,
            turnstile_endpoint TEXT NOT NULL,
            rental_model TEXT NOT NULL,
            invoice_logo_data TEXT NOT NULL DEFAULT '',
            invoice_primary_color TEXT NOT NULL DEFAULT '#0f4c5c',
            invoice_accent_color TEXT NOT NULL DEFAULT '#e36414',
            smtp_host TEXT NOT NULL DEFAULT '',
            smtp_port INTEGER NOT NULL DEFAULT 587,
            smtp_username TEXT NOT NULL DEFAULT '',
            smtp_password TEXT NOT NULL DEFAULT '',
            smtp_sender_email TEXT NOT NULL DEFAULT '',
            smtp_sender_name TEXT NOT NULL DEFAULT 'BauPass Control',
            smtp_use_tls INTEGER NOT NULL DEFAULT 1,
            admin_ip_whitelist TEXT NOT NULL DEFAULT '',
            enforce_tenant_domain INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS companies (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            contact TEXT NOT NULL,
            billing_email TEXT NOT NULL DEFAULT '',
            access_host TEXT NOT NULL DEFAULT '',
            plan TEXT NOT NULL,
            status TEXT NOT NULL,
            deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            company_id TEXT,
            twofa_enabled INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY(company_id) REFERENCES companies(id)
        );

        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            event_type TEXT NOT NULL,
            actor_user_id TEXT,
            actor_role TEXT,
            company_id TEXT,
            target_type TEXT,
            target_id TEXT,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS system_alerts (
            id TEXT PRIMARY KEY,
            code TEXT NOT NULL,
            severity TEXT NOT NULL,
            message TEXT NOT NULL,
            details TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS workers (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            subcompany_id TEXT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            insurance_number TEXT NOT NULL,
            worker_type TEXT NOT NULL DEFAULT 'worker',
            role TEXT NOT NULL,
            site TEXT NOT NULL,
            valid_until TEXT NOT NULL,
            visitor_company TEXT NOT NULL DEFAULT '',
            visit_purpose TEXT NOT NULL DEFAULT '',
            host_name TEXT NOT NULL DEFAULT '',
            visit_end_at TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL,
            photo_data TEXT NOT NULL,
            badge_id TEXT NOT NULL,
            badge_pin_hash TEXT NOT NULL DEFAULT '',
            physical_card_id TEXT,
            deleted_at TEXT,
            FOREIGN KEY(company_id) REFERENCES companies(id),
            FOREIGN KEY(subcompany_id) REFERENCES subcompanies(id)
        );

        CREATE TABLE IF NOT EXISTS subcompanies (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            name TEXT NOT NULL,
            contact TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'aktiv',
            deleted_at TEXT,
            FOREIGN KEY(company_id) REFERENCES companies(id)
        );

        CREATE TABLE IF NOT EXISTS access_logs (
            id TEXT PRIMARY KEY,
            worker_id TEXT NOT NULL,
            direction TEXT NOT NULL,
            gate TEXT NOT NULL,
            note TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY(worker_id) REFERENCES workers(id)
        );

        CREATE TABLE IF NOT EXISTS worker_app_tokens (
            token TEXT PRIMARY KEY,
            worker_id TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            revoked_at TEXT,
            created_by_user_id TEXT,
            FOREIGN KEY(worker_id) REFERENCES workers(id)
        );

        CREATE TABLE IF NOT EXISTS worker_app_sessions (
            token TEXT PRIMARY KEY,
            worker_id TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            FOREIGN KEY(worker_id) REFERENCES workers(id)
        );

        CREATE TABLE IF NOT EXISTS day_close_acknowledgements (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            company_id TEXT,
            acknowledged_by_user_id TEXT NOT NULL,
            comment TEXT NOT NULL,
            open_count INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(acknowledged_by_user_id) REFERENCES users(id),
            FOREIGN KEY(company_id) REFERENCES companies(id)
        );

        CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            invoice_number TEXT NOT NULL,
            company_id TEXT NOT NULL,
            recipient_email TEXT NOT NULL,
            invoice_date TEXT NOT NULL,
            invoice_period TEXT NOT NULL,
            description TEXT NOT NULL,
            net_amount REAL NOT NULL,
            vat_rate REAL NOT NULL,
            vat_amount REAL NOT NULL,
            total_amount REAL NOT NULL,
            status TEXT NOT NULL,
            error_message TEXT,
            sent_at TEXT,
            rendered_html TEXT NOT NULL,
            created_by_user_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(company_id) REFERENCES companies(id),
            FOREIGN KEY(created_by_user_id) REFERENCES users(id)
        );
        """
    )

    setting_exists = cur.execute("SELECT id FROM settings WHERE id = 1").fetchone()
    if not setting_exists:
        cur.execute(
            """
            INSERT INTO settings (
                id, platform_name, operator_name, turnstile_endpoint, rental_model,
                invoice_logo_data, invoice_primary_color, invoice_accent_color,
                smtp_host, smtp_port, smtp_username, smtp_password, smtp_sender_email, smtp_sender_name, smtp_use_tls,
                admin_ip_whitelist, enforce_tenant_domain
            ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("BauPass Control", "Deine Betriebsfirma", "", "tageskarte", "", "#0f4c5c", "#e36414", "", 587, "", "", "", "BauPass Control", 1, "", 0),
        )

    settings_columns = [row[1] for row in cur.execute("PRAGMA table_info(settings)").fetchall()]
    if "invoice_logo_data" not in settings_columns:
        cur.execute("ALTER TABLE settings ADD COLUMN invoice_logo_data TEXT NOT NULL DEFAULT ''")
    if "invoice_primary_color" not in settings_columns:
        cur.execute("ALTER TABLE settings ADD COLUMN invoice_primary_color TEXT NOT NULL DEFAULT '#0f4c5c'")
    if "invoice_accent_color" not in settings_columns:
        cur.execute("ALTER TABLE settings ADD COLUMN invoice_accent_color TEXT NOT NULL DEFAULT '#e36414'")
    if "smtp_host" not in settings_columns:
        cur.execute("ALTER TABLE settings ADD COLUMN smtp_host TEXT NOT NULL DEFAULT ''")
    if "smtp_port" not in settings_columns:
        cur.execute("ALTER TABLE settings ADD COLUMN smtp_port INTEGER NOT NULL DEFAULT 587")
    if "smtp_username" not in settings_columns:
        cur.execute("ALTER TABLE settings ADD COLUMN smtp_username TEXT NOT NULL DEFAULT ''")
    if "smtp_password" not in settings_columns:
        cur.execute("ALTER TABLE settings ADD COLUMN smtp_password TEXT NOT NULL DEFAULT ''")
    if "smtp_sender_email" not in settings_columns:
        cur.execute("ALTER TABLE settings ADD COLUMN smtp_sender_email TEXT NOT NULL DEFAULT ''")
    if "smtp_sender_name" not in settings_columns:
        cur.execute("ALTER TABLE settings ADD COLUMN smtp_sender_name TEXT NOT NULL DEFAULT 'BauPass Control'")
    if "smtp_use_tls" not in settings_columns:
        cur.execute("ALTER TABLE settings ADD COLUMN smtp_use_tls INTEGER NOT NULL DEFAULT 1")
    if "admin_ip_whitelist" not in settings_columns:
        cur.execute("ALTER TABLE settings ADD COLUMN admin_ip_whitelist TEXT NOT NULL DEFAULT ''")
    if "enforce_tenant_domain" not in settings_columns:
        cur.execute("ALTER TABLE settings ADD COLUMN enforce_tenant_domain INTEGER NOT NULL DEFAULT 0")

    company_exists = cur.execute("SELECT id FROM companies LIMIT 1").fetchone()
    if not company_exists:
        company_id = "cmp-default"
        cur.execute(
            "INSERT INTO companies (id, name, contact, plan, status) VALUES (?, ?, ?, ?, ?)",
            (company_id, "Muster Bau GmbH", "Sabine Keller", "tageskarte", "test"),
        )

        users = [
            ("usr-superadmin", "superadmin", generate_password_hash("1234"), "Systemleitung", "superadmin", None),
            ("usr-company", "firma", generate_password_hash("1234"), "Firmen-Admin", "company-admin", company_id),
            ("usr-turnstile", "drehkreuz", generate_password_hash("1234"), "Drehkreuz Terminal", "turnstile", company_id),
        ]
        cur.executemany(
            "INSERT INTO users (id, username, password_hash, name, role, company_id) VALUES (?, ?, ?, ?, ?, ?)",
            users,
        )

    # Migration fuer alte Datenbankversionen mit Klartextpasswoertern.
    columns = [row[1] for row in cur.execute("PRAGMA table_info(users)").fetchall()]
    if "password_hash" not in columns:
        cur.execute("ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''")
        columns = [row[1] for row in cur.execute("PRAGMA table_info(users)").fetchall()]

    if "password" in columns:
        rows = cur.execute("SELECT id, password, password_hash FROM users").fetchall()
        for row in rows:
            if row[2]:
                continue
            current = row[1] or "1234"
            hashed = current if current.startswith("pbkdf2:") or current.startswith("scrypt:") else generate_password_hash(current)
            cur.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hashed, row[0]))
    else:
        rows = cur.execute("SELECT id, password_hash FROM users").fetchall()
        for row in rows:
            if not row[1]:
                cur.execute("UPDATE users SET password_hash = ? WHERE id = ?", (generate_password_hash("1234"), row[0]))

    company_columns = [row[1] for row in cur.execute("PRAGMA table_info(companies)").fetchall()]
    if "deleted_at" not in company_columns:
        cur.execute("ALTER TABLE companies ADD COLUMN deleted_at TEXT")
    if "billing_email" not in company_columns:
        cur.execute("ALTER TABLE companies ADD COLUMN billing_email TEXT NOT NULL DEFAULT ''")
    if "access_host" not in company_columns:
        cur.execute("ALTER TABLE companies ADD COLUMN access_host TEXT NOT NULL DEFAULT ''")

    worker_columns = [row[1] for row in cur.execute("PRAGMA table_info(workers)").fetchall()]
    if "deleted_at" not in worker_columns:
        cur.execute("ALTER TABLE workers ADD COLUMN deleted_at TEXT")
    if "subcompany_id" not in worker_columns:
        cur.execute("ALTER TABLE workers ADD COLUMN subcompany_id TEXT")
    if "worker_type" not in worker_columns:
        cur.execute("ALTER TABLE workers ADD COLUMN worker_type TEXT NOT NULL DEFAULT 'worker'")
    if "visitor_company" not in worker_columns:
        cur.execute("ALTER TABLE workers ADD COLUMN visitor_company TEXT NOT NULL DEFAULT ''")
    if "visit_purpose" not in worker_columns:
        cur.execute("ALTER TABLE workers ADD COLUMN visit_purpose TEXT NOT NULL DEFAULT ''")
    if "host_name" not in worker_columns:
        cur.execute("ALTER TABLE workers ADD COLUMN host_name TEXT NOT NULL DEFAULT ''")
    if "visit_end_at" not in worker_columns:
        cur.execute("ALTER TABLE workers ADD COLUMN visit_end_at TEXT NOT NULL DEFAULT ''")
    if "badge_pin_hash" not in worker_columns:
        cur.execute("ALTER TABLE workers ADD COLUMN badge_pin_hash TEXT NOT NULL DEFAULT ''")
    if "physical_card_id" not in worker_columns:
        cur.execute("ALTER TABLE workers ADD COLUMN physical_card_id TEXT")

    if "worker_app_enabled" not in settings_columns:
        cur.execute("ALTER TABLE settings ADD COLUMN worker_app_enabled INTEGER NOT NULL DEFAULT 1")

    session_columns = [row[1] for row in cur.execute("PRAGMA table_info(sessions)").fetchall()]
    if "last_seen" not in session_columns:
        cur.execute("ALTER TABLE sessions ADD COLUMN last_seen TEXT")

    invoice_columns = [row[1] for row in cur.execute("PRAGMA table_info(invoices)").fetchall()]
    if "due_date" not in invoice_columns:
        cur.execute("ALTER TABLE invoices ADD COLUMN due_date TEXT")
    if "paid_at" not in invoice_columns:
        cur.execute("ALTER TABLE invoices ADD COLUMN paid_at TEXT")
    if "auto_suspend_triggered_at" not in invoice_columns:
        cur.execute("ALTER TABLE invoices ADD COLUMN auto_suspend_triggered_at TEXT")
    if "reminder_stage" not in invoice_columns:
        cur.execute("ALTER TABLE invoices ADD COLUMN reminder_stage INTEGER NOT NULL DEFAULT 0")
    if "last_reminder_sent_at" not in invoice_columns:
        cur.execute("ALTER TABLE invoices ADD COLUMN last_reminder_sent_at TEXT")
    if "last_reminder_error" not in invoice_columns:
        cur.execute("ALTER TABLE invoices ADD COLUMN last_reminder_error TEXT")

    # Rechnungsnummern pro Firma eindeutig halten: Alt-Duplikate bereinigen und Unique-Index setzen.
    duplicates = cur.execute(
        """
        SELECT company_id, invoice_number, COUNT(*) AS c
        FROM invoices
        WHERE invoice_number IS NOT NULL AND TRIM(invoice_number) <> ''
        GROUP BY company_id, invoice_number
        HAVING COUNT(*) > 1
        """
    ).fetchall()
    for dup in duplicates:
        rows = cur.execute(
            """
            SELECT id, invoice_number
            FROM invoices
            WHERE company_id = ? AND invoice_number = ?
            ORDER BY created_at ASC, id ASC
            """,
            (dup[0], dup[1]),
        ).fetchall()
        for idx, row in enumerate(rows[1:], start=2):
            base = str(row[1] or "RE").strip() or "RE"
            candidate = f"{base}-{idx}"
            suffix = idx
            while cur.execute(
                "SELECT 1 FROM invoices WHERE company_id = ? AND invoice_number = ? AND id <> ?",
                (dup[0], candidate, row[0]),
            ).fetchone():
                suffix += 1
                candidate = f"{base}-{suffix}"
            cur.execute("UPDATE invoices SET invoice_number = ? WHERE id = ?", (candidate, row[0]))

    cur.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_company_invoice_number_unique ON invoices(company_id, invoice_number)"
    )

    db.commit()
    db.close()


init_db()


def row_to_dict(row):
    return dict(row) if row is not None else None


def serialize_user(user_row):
    if not user_row:
        return None
    return {
        "id": user_row["id"],
        "username": user_row["username"],
        "name": user_row["name"],
        "role": user_row["role"],
        "company_id": user_row["company_id"],
        "twofa_enabled": int(user_row["twofa_enabled"]),
    }


def log_audit(event_type, message, target_type=None, target_id=None, company_id=None, actor=None):
    db = get_db()
    actor_user_id = actor["id"] if actor else None
    actor_role = actor["role"] if actor else None
    resolved_company = company_id if company_id is not None else (actor.get("company_id") if actor else None)
    db.execute(
        """
        INSERT INTO audit_logs (id, event_type, actor_user_id, actor_role, company_id, target_type, target_id, message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            f"aud-{secrets.token_hex(8)}",
            event_type,
            actor_user_id,
            actor_role,
            resolved_company,
            target_type,
            target_id,
            message,
            now_iso(),
        ),
    )
    db.commit()


def is_tenant_host_valid(db, user):
    if not user or user.get("role") == "superadmin":
        return True
    setting = db.execute("SELECT enforce_tenant_domain FROM settings WHERE id = 1").fetchone()
    if not setting or int(setting["enforce_tenant_domain"]) != 1:
        return True
    company_id = user.get("company_id")
    if not company_id:
        return True
    company = db.execute("SELECT access_host FROM companies WHERE id = ?", (company_id,)).fetchone()
    required_host = (company["access_host"] if company else "").strip().lower()
    if not required_host:
        return True
    return get_request_host() == required_host


def require_auth(handler):
    @wraps(handler)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "unauthorized"}), 401

        token = auth_header.split(" ", 1)[1]
        db = get_db()
        session = db.execute("SELECT user_id, expires_at FROM sessions WHERE token = ?", (token,)).fetchone()
        if not session:
            return jsonify({"error": "invalid_session"}), 401

        if session["expires_at"] < now_iso():
            db.execute("DELETE FROM sessions WHERE token = ?", (token,))
            db.commit()
            return jsonify({"error": "session_expired"}), 401

        user = db.execute("SELECT * FROM users WHERE id = ?", (session["user_id"],)).fetchone()
        if not user:
            return jsonify({"error": "invalid_user"}), 401

        user_payload = row_to_dict(user)

        if not is_tenant_host_valid(db, user_payload):
            return jsonify({"error": "forbidden_tenant_host"}), 403

        if user_payload.get("role") != "superadmin":
            company_error = get_company_access_error(db, user_payload.get("company_id"))
            if company_error:
                db.execute("DELETE FROM sessions WHERE token = ?", (token,))
                db.commit()
                return jsonify(company_error), 403

        if user_payload.get("role") in ["superadmin", "company-admin"]:
            settings_row = db.execute("SELECT admin_ip_whitelist FROM settings WHERE id = 1").fetchone()
            whitelist = parse_ip_whitelist(settings_row["admin_ip_whitelist"] if settings_row else "")
            if whitelist and not ip_allowed(get_client_ip(), whitelist):
                return jsonify({"error": "admin_ip_not_allowed"}), 403

        db.execute("UPDATE sessions SET expires_at = ? WHERE token = ?", (expiry_iso(), token))
        db.commit()

        g.current_user = user_payload
        g.token = token
        return handler(*args, **kwargs)

    return wrapper


def require_roles(*roles):
    def decorator(handler):
        @wraps(handler)
        def wrapper(*args, **kwargs):
            user = g.current_user
            if user["role"] not in roles:
                return jsonify({"error": "forbidden"}), 403
            return handler(*args, **kwargs)

        return wrapper

    return decorator


def require_worker_session(handler):
    @wraps(handler)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "unauthorized"}), 401

        token = auth_header.split(" ", 1)[1]
        db = get_db()
        purge_expired_worker_app_sessions(db)
        db.commit()
        session = db.execute("SELECT worker_id, expires_at FROM worker_app_sessions WHERE token = ?", (token,)).fetchone()
        if not session:
            return jsonify({"error": "invalid_worker_session"}), 401

        if session["expires_at"] < now_iso():
            db.execute("DELETE FROM worker_app_sessions WHERE token = ?", (token,))
            db.commit()
            return jsonify({"error": "worker_session_expired"}), 401

        worker = db.execute("SELECT * FROM workers WHERE id = ?", (session["worker_id"],)).fetchone()
        if not worker or worker["deleted_at"]:
            return jsonify({"error": "worker_not_available"}), 401

        company_error = get_company_access_error(db, worker["company_id"])
        if company_error:
            db.execute("DELETE FROM worker_app_sessions WHERE token = ?", (token,))
            db.commit()
            return jsonify(company_error), 403

        g.worker = row_to_dict(worker)
        g.worker_token = token
        g.worker_session_expires_at = session["expires_at"]
        return handler(*args, **kwargs)

    return wrapper


# --- API: Foto-Upload für Mitarbeiter (nach require_worker_session und app Definitionen!) ---
@app.post("/api/worker-app/photo")
@require_worker_session
def update_worker_photo():
    payload = request.get_json(silent=True) or {}
    photo_data = payload.get("photoData", "").strip()
    if not photo_data:
        return jsonify({"error": "missing_photo_data"}), 400
    db = get_db()
    db.execute("UPDATE workers SET photo_data = ? WHERE id = ?", (photo_data, g.worker["id"]))
    db.commit()
    return jsonify({"ok": True})

def visible_company_clause(user):
    if user["role"] == "superadmin":
        return "", []
    return " WHERE id = ?", [user["company_id"]]


def check_and_apply_overdue_suspensions(db):
    """Checks for overdue unpaid invoices and auto-locks companies."""
    today = now_iso().split("T")[0]
    overdue_rows = db.execute(
        """
        SELECT DISTINCT inv.company_id FROM invoices AS inv
        WHERE inv.status IN ('sent', 'overdue')
          AND inv.paid_at IS NULL
          AND inv.due_date IS NOT NULL
                    AND DATE(inv.due_date) <= DATE(?, ?)
        """,
                (today, f"-{AUTO_SUSPEND_GRACE_DAYS} day"),
    ).fetchall()

    suspended_companies = []
    for row in overdue_rows:
        company_id = row[0]
        company = db.execute("SELECT id, name, status FROM companies WHERE id = ?", (company_id,)).fetchone()
        if not company:
            continue
        if company["status"] != "gesperrt":
            db.execute(
                "UPDATE companies SET status = ? WHERE id = ?",
                ("gesperrt", company_id),
            )
            db.execute(
                "UPDATE invoices SET auto_suspend_triggered_at = ? WHERE company_id = ? AND paid_at IS NULL AND auto_suspend_triggered_at IS NULL",
                (now_iso(), company_id),
            )
            log_audit(
                "company.auto_suspended_overdue_invoice",
                f"Firma '{company['name']}' automatically suspended due to overdue invoice",
                target_type="company",
                target_id=company_id,
            )
            suspended_companies.append(company_id)

    if suspended_companies:
        db.commit()
    return suspended_companies


def send_payment_reminder_email(invoice_row, company_row, settings_row, stage, days_until_due):
    smtp_host = (settings_row["smtp_host"] or "").strip()
    smtp_sender = (settings_row["smtp_sender_email"] or "").strip()
    if not smtp_host or not smtp_sender:
        return False, "SMTP ist nicht konfiguriert"

    stage_label = {1: "Erinnerung", 2: "Letzte Erinnerung", 3: "Überfällig"}.get(stage, "Erinnerung")
    due_label = invoice_row["due_date"] or "-"

    if days_until_due < 0:
        timing_text = f"seit {abs(days_until_due)} Tag(en) überfällig"
    elif days_until_due == 0:
        timing_text = "heute faellig"
    else:
        timing_text = f"in {days_until_due} Tag(en) faellig"

    message = EmailMessage()
    message["Subject"] = f"{stage_label}: Rechnung {invoice_row['invoice_number']} ({timing_text})"
    message["From"] = f"{settings_row['smtp_sender_name']} <{smtp_sender}>"
    message["To"] = invoice_row["recipient_email"]
    message.set_content(
        (
            f"Guten Tag,\n\n"
            f"dies ist eine Zahlungs-{stage_label.lower()} für die Rechnung {invoice_row['invoice_number']} "
            f"({company_row['name']}).\n"
            f"Faelligkeit: {due_label} ({timing_text})\n"
            f"Offener Betrag: {float(invoice_row['total_amount'] or 0):.2f} EUR\n\n"
            f"Bitte begleichen Sie den Betrag zeitnah, um eine Sperrung zu vermeiden.\n\n"
            f"Viele Grüße\n{settings_row['operator_name']}"
        )
    )

    try:
        with smtplib.SMTP(smtp_host, int(settings_row["smtp_port"] or 587), timeout=20) as smtp:
            if int(settings_row["smtp_use_tls"] or 0) == 1:
                smtp.starttls()
            smtp_username = (settings_row["smtp_username"] or "").strip()
            if smtp_username:
                smtp.login(smtp_username, settings_row["smtp_password"] or "")
            smtp.send_message(message)
        return True, ""
    except Exception as exc:
        return False, str(exc)


def run_invoice_dunning_cycle(db):
    """Update overdue status and send staged reminders before automatic suspension."""
    today = datetime.utcnow().date()
    settings = db.execute("SELECT * FROM settings WHERE id = 1").fetchone()
    rows = db.execute(
        """
        SELECT invoices.*, companies.name AS company_name, companies.deleted_at AS company_deleted_at
        FROM invoices
        JOIN companies ON companies.id = invoices.company_id
        WHERE invoices.paid_at IS NULL
          AND invoices.due_date IS NOT NULL
          AND invoices.status IN ('sent', 'overdue')
        ORDER BY invoices.created_at ASC
        """
    ).fetchall()

    result = {
        "remindersSent": 0,
        "reminderFailures": 0,
        "overdueUpdated": 0,
    }

    for row in rows:
        if row["company_deleted_at"]:
            continue

        due_date = parse_iso_date(row["due_date"])
        if not due_date:
            continue

        days_until_due = (due_date - today).days
        invoice_id = row["id"]
        current_stage = int(row["reminder_stage"] or 0)
        last_reminder_day = str(row["last_reminder_sent_at"] or "")[:10]

        if days_until_due < 0 and row["status"] != "overdue":
            db.execute("UPDATE invoices SET status = 'overdue' WHERE id = ?", (invoice_id,))
            result["overdueUpdated"] += 1

        target_stage = 0
        if days_until_due <= 7 and days_until_due > 3:
            target_stage = 1
        elif days_until_due <= 3 and days_until_due >= 0:
            target_stage = 2
        elif days_until_due < 0:
            target_stage = 3

        if target_stage == 0:
            continue

        should_send = target_stage > current_stage or (target_stage == 3 and last_reminder_day != today.isoformat())
        if not should_send:
            continue

        company_row = {"name": row["company_name"]}
        sent_ok, error_message = send_payment_reminder_email(row, company_row, settings, target_stage, days_until_due)

        if sent_ok:
            db.execute(
                "UPDATE invoices SET reminder_stage = ?, last_reminder_sent_at = ?, last_reminder_error = '' WHERE id = ?",
                (target_stage, now_iso(), invoice_id),
            )
            log_audit(
                "invoice.reminder_sent",
                f"Mahnstufe {target_stage} für Rechnung {row['invoice_number']} versendet",
                target_type="invoice",
                target_id=invoice_id,
                company_id=row["company_id"],
                actor=None,
            )
            result["remindersSent"] += 1
        else:
            db.execute(
                "UPDATE invoices SET last_reminder_error = ? WHERE id = ?",
                (error_message, invoice_id),
            )
            log_audit(
                "invoice.reminder_failed",
                f"Mahnstufe {target_stage} für Rechnung {row['invoice_number']} fehlgeschlagen: {error_message}",
                target_type="invoice",
                target_id=invoice_id,
                company_id=row["company_id"],
                actor=None,
            )
            result["reminderFailures"] += 1

    db.commit()
    return result


def create_system_alert(db, code, severity, message, details="", dedup_minutes=ALERT_DEDUP_MINUTES):
    details_text = details if isinstance(details, str) else json.dumps(details, ensure_ascii=False)
    threshold = (datetime.utcnow() - timedelta(minutes=dedup_minutes)).replace(microsecond=0).isoformat() + "Z"
    recent = db.execute(
        """
        SELECT id
        FROM system_alerts
        WHERE code = ? AND severity = ? AND message = ? AND created_at >= ?
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (code, severity, message, threshold),
    ).fetchone()
    if recent:
        return None

    alert_id = f"alert-{secrets.token_hex(6)}"
    db.execute(
        "INSERT INTO system_alerts (id, code, severity, message, details, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (alert_id, code, severity, message, details_text, now_iso()),
    )
    db.commit()
    return alert_id


def rotate_import_backups(backup_dir):
    now_dt = datetime.utcnow()
    removed = 0
    kept = 0
    errors = 0

    for path in backup_dir.glob("import-backup-*.json"):
        try:
            mtime = datetime.utcfromtimestamp(path.stat().st_mtime)
            age_days = (now_dt - mtime).days
            if age_days >= BACKUP_RETENTION_DAYS:
                path.unlink(missing_ok=True)
                removed += 1
            else:
                kept += 1
        except Exception:
            errors += 1

    return {"removed": removed, "kept": kept, "errors": errors, "retentionDays": BACKUP_RETENTION_DAYS}


def create_import_rollback_backup(db, role, target_company_id):
    backup_dir = BASE_DIR / "backend" / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    rotation = rotate_import_backups(backup_dir)

    company_clause = ""
    company_params = []
    if role != "superadmin" or target_company_id:
        scope_id = target_company_id
        company_clause = " WHERE company_id = ?"
        company_params = [scope_id]

    payload = {
        "meta": {
            "type": "import-rollback-backup",
            "createdAt": now_iso(),
            "scopeCompanyId": target_company_id,
            "role": role,
        },
        "companies": [],
        "subcompanies": [],
        "workers": [],
        "accessLogs": [],
        "invoices": [],
    }

    if role == "superadmin" and not target_company_id:
        payload["companies"] = [row_to_dict(row) for row in db.execute("SELECT * FROM companies ORDER BY name").fetchall()]
    elif target_company_id:
        payload["companies"] = [
            row_to_dict(row)
            for row in db.execute("SELECT * FROM companies WHERE id = ? ORDER BY name", (target_company_id,)).fetchall()
        ]

    payload["subcompanies"] = [
        row_to_dict(row)
        for row in db.execute(f"SELECT * FROM subcompanies{company_clause} ORDER BY name", company_params).fetchall()
    ]
    payload["workers"] = [
        row_to_dict(row)
        for row in db.execute(f"SELECT * FROM workers{company_clause} ORDER BY last_name, first_name", company_params).fetchall()
    ]
    payload["invoices"] = [
        row_to_dict(row)
        for row in db.execute(f"SELECT * FROM invoices{company_clause} ORDER BY created_at DESC", company_params).fetchall()
    ]

    worker_ids = [row["id"] for row in payload["workers"]]
    if worker_ids:
        placeholders = ",".join(["?"] * len(worker_ids))
        payload["accessLogs"] = [
            row_to_dict(row)
            for row in db.execute(
                f"SELECT * FROM access_logs WHERE worker_id IN ({placeholders}) ORDER BY timestamp DESC",
                worker_ids,
            ).fetchall()
        ]

    filename = f"import-backup-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}-{secrets.token_hex(3)}.json"
    backup_path = backup_dir / filename
    backup_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    if rotation.get("errors"):
        create_system_alert(
            db,
            code="backup_rotation_errors",
            severity="warning",
            message="Backup-Rotation hatte Fehler.",
            details=rotation,
        )
    return str(backup_path)


def run_dunning_job_once():
    global DUNNING_LAST_RUN_AT, DUNNING_LAST_RESULT
    with app.app_context():
        db = get_db()
        result = run_invoice_dunning_cycle(db)
        suspended = check_and_apply_overdue_suspensions(db)
        result["suspendedCompanies"] = len(suspended)
        if int(result.get("reminderFailures", 0)) > 0:
            create_system_alert(
                db,
                code="dunning_reminder_failures",
                severity="warning",
                message=f"Dunning hatte {int(result.get('reminderFailures', 0))} fehlgeschlagene Erinnerungen.",
                details=result,
            )
        if int(result.get("suspendedCompanies", 0)) > 0:
            create_system_alert(
                db,
                code="dunning_company_suspensions",
                severity="info",
                message=f"Dunning hat {int(result.get('suspendedCompanies', 0))} Firmen gesperrt.",
                details=result,
                dedup_minutes=10,
            )
        DUNNING_LAST_RUN_AT = now_iso()
        DUNNING_LAST_RESULT = result


def start_background_jobs():
    global _background_started
    with _background_lock:
        if _background_started:
            return
        _background_started = True

    interval_hours = max(1, int(os.getenv("BAUPASS_DUNNING_INTERVAL_HOURS", "24")))
    session_cleanup_seconds = max(60, int(os.getenv("BAUPASS_WORKER_SESSION_CLEANUP_SECONDS", "300")))

    def scheduler_loop():
        while True:
            try:
                run_dunning_job_once()
                with app.app_context():
                    db = get_db()
                    backup_dir = BASE_DIR / "backend" / "backups"
                    backup_dir.mkdir(parents=True, exist_ok=True)
                    rotation = rotate_import_backups(backup_dir)
                    if rotation.get("errors"):
                        create_system_alert(
                            db,
                            code="backup_rotation_errors",
                            severity="warning",
                            message="Geplante Backup-Rotation hatte Fehler.",
                            details=rotation,
                        )
            except Exception as exc:
                with app.app_context():
                    db = get_db()
                    create_system_alert(
                        db,
                        code="dunning_scheduler_error",
                        severity="critical",
                        message="Dunning-Scheduler ist fehlgeschlagen.",
                        details={"error": str(exc)},
                    )
            time.sleep(interval_hours * 3600)

    def worker_session_cleanup_loop():
        while True:
            try:
                with app.app_context():
                    db = get_db()
                    auto_close_expired_visitor_entries(db)
                    deleted = purge_expired_worker_app_sessions(db)
                    if deleted > 0:
                        db.commit()
            except Exception:
                # Ignore cleanup loop failures; auth still enforces token expiry.
                pass
            time.sleep(session_cleanup_seconds)

    threading.Thread(target=scheduler_loop, name="baupass-dunning-scheduler", daemon=True).start()
    threading.Thread(target=worker_session_cleanup_loop, name="baupass-worker-session-cleanup", daemon=True).start()


def get_company_access_error(db, company_id):
    if not company_id:
        return None

    company = db.execute("SELECT id, name, status, deleted_at FROM companies WHERE id = ?", (company_id,)).fetchone()
    if not company:
        return {"error": "company_not_found", "companyStatus": "unbekannt", "companyName": "Unbekannte Firma"}
    if company["deleted_at"]:
        return {"error": "company_deleted", "companyStatus": "geloescht", "companyName": company["name"]}

    status = (company["status"] or "aktiv").strip().lower()
    if status == "gesperrt":
        return {
            "error": "company_locked",
            "companyStatus": status,
            "companyName": company["name"],
            "message": f"Firma {company['name']} ist wegen offener Zahlung gesperrt.",
        }
    return None


def visible_worker_clause(user, prefix=""):
    if user["role"] == "superadmin":
        return "", []
    return f" WHERE {prefix}company_id = ?", [user["company_id"]]


def visible_log_clause(user):
    if user["role"] == "superadmin":
        return "", []
    return " WHERE workers.company_id = ?", [user["company_id"]]


def resolve_subcompany_id(db, company_id, subcompany_id):
    candidate = (subcompany_id or "").strip()
    if not candidate:
        return None

    row = db.execute(
        "SELECT * FROM subcompanies WHERE id = ? AND company_id = ?",
        (candidate, company_id),
    ).fetchone()
    if not row:
        raise ValueError("subcompany_not_found")
    if row["deleted_at"]:
        raise ValueError("subcompany_deleted")
    return candidate


def parse_iso_utc(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def build_access_filters(user, direction="", gate="", from_date="", to_date=""):
    clause, base_params = visible_log_clause(user)
    params = list(base_params)
    conditions = []

    if clause:
        conditions.append(clause.replace(" WHERE ", "", 1))

    conditions.append("workers.deleted_at IS NULL")

    if direction:
        conditions.append("access_logs.direction = ?")
        params.append(direction)

    if gate:
        conditions.append("lower(access_logs.gate) LIKE ?")
        params.append(f"%{gate.lower()}%")

    if from_date:
        conditions.append("access_logs.timestamp >= ?")
        params.append(f"{from_date}T00:00:00Z")

    if to_date:
        conditions.append("access_logs.timestamp <= ?")
        params.append(f"{to_date}T23:59:59Z")

    return conditions, params


def build_open_entries_from_rows(rows, now_dt):
    last_event_by_worker = {}
    for row in rows:
        last_event_by_worker[row["worker_id"]] = {
            "workerId": row["worker_id"],
            "name": f"{row['first_name']} {row['last_name']}",
            "badgeId": row["badge_id"],
            "gate": row["gate"],
            "timestamp": row["timestamp"],
            "direction": row["direction"],
        }
    open_entries = []
    for item in last_event_by_worker.values():
        if item["direction"] != "check-in":
            continue

        entry_dt = parse_iso_utc(item["timestamp"])
        minutes_open = 0
        if entry_dt:
            minutes_open = max(int((now_dt - entry_dt).total_seconds() // 60), 0)

        if minutes_open >= 240:
            severity = "red"
        elif minutes_open >= 120:
            severity = "yellow"
        else:
            severity = "green"

        open_entries.append(
            {
                **item,
                "openMinutes": minutes_open,
                "severity": severity,
            }
        )

    open_entries.sort(key=lambda entry: entry["timestamp"], reverse=True)
    return open_entries


def auto_close_expired_visitor_entries(db, reference_dt=None):
    now_dt = reference_dt or datetime.now(timezone.utc)
    rows = db.execute(
        """
        SELECT workers.id AS worker_id, workers.first_name, workers.last_name, workers.badge_id,
               workers.visit_end_at, access_logs.direction, access_logs.gate, access_logs.timestamp
        FROM workers
        JOIN (
            SELECT worker_id, MAX(timestamp) AS latest_ts
            FROM access_logs
            GROUP BY worker_id
        ) latest ON latest.worker_id = workers.id
        JOIN access_logs ON access_logs.worker_id = latest.worker_id AND access_logs.timestamp = latest.latest_ts
        WHERE workers.deleted_at IS NULL
          AND workers.worker_type = 'visitor'
          AND workers.visit_end_at != ''
          AND access_logs.direction = 'check-in'
        """
    ).fetchall()

    auto_closed = []
    for row in rows:
        visit_end_dt = parse_iso_utc(row["visit_end_at"])
        if not visit_end_dt or visit_end_dt > now_dt:
            continue
        close_timestamp = visit_end_dt.astimezone(timezone.utc).replace(tzinfo=None, microsecond=0).isoformat() + "Z"
        log_id = f"log-{secrets.token_hex(6)}"
        db.execute(
            "INSERT INTO access_logs (id, worker_id, direction, gate, note, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
            (
                log_id,
                row["worker_id"],
                "check-out",
                row["gate"] or "System Besucherende",
                "Automatischer Austritt nach Besucher-Ende",
                close_timestamp,
            ),
        )
        auto_closed.append(
            {
                "workerId": row["worker_id"],
                "name": f"{row['first_name']} {row['last_name']}",
                "badgeId": row["badge_id"],
                "timestamp": close_timestamp,
            }
        )

    if auto_closed:
        db.commit()
        log_audit(
            "access.auto_visitor_close",
            f"{len(auto_closed)} Besucher automatisch nach Ablauf ausgetragen",
            target_type="access",
            target_id=now_dt.date().isoformat(),
        )

    return auto_closed


def auto_close_open_entries_after_midnight(db):
    day_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    day_start_iso = day_start.isoformat().replace("+00:00", "Z")

    rows = db.execute(
        """
        SELECT workers.id AS worker_id, workers.company_id, workers.first_name, workers.last_name, workers.badge_id,
               access_logs.direction, access_logs.gate, access_logs.timestamp
        FROM workers
        JOIN (
            SELECT worker_id, MAX(timestamp) AS latest_ts
            FROM access_logs
            GROUP BY worker_id
        ) latest ON latest.worker_id = workers.id
        JOIN access_logs ON access_logs.worker_id = latest.worker_id AND access_logs.timestamp = latest.latest_ts
        WHERE workers.deleted_at IS NULL
          AND access_logs.direction = 'check-in'
          AND access_logs.timestamp < ?
        """,
        (day_start_iso,),
    ).fetchall()

    auto_closed = []
    for row in rows:
        log_id = f"log-{secrets.token_hex(6)}"
        db.execute(
            "INSERT INTO access_logs (id, worker_id, direction, gate, note, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
            (
                log_id,
                row["worker_id"],
                "check-out",
                row["gate"] or "System Tagesabschluss",
                "Automatischer Austritt nach 00:00",
                day_start_iso,
            ),
        )
        auto_closed.append(
            {
                "workerId": row["worker_id"],
                "name": f"{row['first_name']} {row['last_name']}",
                "badgeId": row["badge_id"],
                "timestamp": day_start_iso,
            }
        )

    if auto_closed:
        db.commit()
        log_audit(
            "access.auto_day_close",
            f"{len(auto_closed)} offene Eintritte nach 00:00 automatisch ausgetragen",
            target_type="access",
            target_id=day_start.date().isoformat(),
        )

    return auto_closed


@app.get("/api/health")
def health():
    diagnostics = get_runtime_diagnostics()
    return jsonify(
        {
            "status": "ok",
            "time": now_iso(),
            "warnings": len(diagnostics["warnings"]),
            "recoveryEnabled": diagnostics["recoveryEnabled"],
            "gateApiConfigured": diagnostics["gateApiConfigured"],
        }
    )


@app.get("/api/phone-test")
def phone_test_api():
        return jsonify(
                {
                        "status": "ok",
                        "time": now_iso(),
                        "host": request.host,
                        "remoteAddr": request.remote_addr,
                        "userAgent": request.headers.get("User-Agent", ""),
                }
        )


@app.get("/phone-test")
def phone_test_page():
        host = html.escape(request.host or "")
        remote_addr = html.escape(request.remote_addr or "")
        user_agent = html.escape(request.headers.get("User-Agent", ""))
        now_value = html.escape(now_iso())
        return f"""
<!DOCTYPE html>
<html lang=\"de\">
<head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>BauPass Telefon-Test</title>
    <style>
        body {{
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif;
            background: #f8f7f4;
            color: #1f1f1f;
        }}
        .card {{
            max-width: 700px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #ddd;
            border-radius: 12px;
            padding: 16px;
        }}
        .ok {{
            color: #0a7a2f;
            font-weight: 700;
            margin: 0 0 12px;
        }}
        .row {{
            margin: 6px 0;
            word-break: break-all;
        }}
    </style>
</head>
<body>
    <main class=\"card\">
        <p class=\"ok\">BauPass Telefon-Test: ERREICHBAR</p>
        <p class=\"row\"><strong>Zeit:</strong> {now_value}</p>
        <p class=\"row\"><strong>Host:</strong> {host}</p>
        <p class=\"row\"><strong>Client-IP:</strong> {remote_addr}</p>
        <p class=\"row\"><strong>User-Agent:</strong> {user_agent}</p>
    </main>
</body>
</html>
"""


def get_runtime_diagnostics():
    diagnostics = {
        "warnings": [],
        "recoveryEnabled": bool((os.getenv("BAUPASS_RECOVERY_SECRET") or "").strip()),
        "gateApiConfigured": bool((os.getenv("BAUPASS_GATE_API_KEY") or "").strip()),
        "publicBaseUrlConfigured": bool((os.getenv("PUBLIC_BASE_URL") or os.getenv("RENDER_EXTERNAL_URL") or "").strip()),
    }

    if not diagnostics["recoveryEnabled"]:
        diagnostics["warnings"].append(
            {
                "code": "missing_recovery_secret",
                "message": "BAUPASS_RECOVERY_SECRET ist nicht gesetzt. Admin-Recovery ist deaktiviert.",
            }
        )
    if not diagnostics["gateApiConfigured"]:
        diagnostics["warnings"].append(
            {
                "code": "missing_gate_api_key",
                "message": "BAUPASS_GATE_API_KEY ist nicht gesetzt. NFC-Gate-Tap ist deaktiviert.",
            }
        )
    if not diagnostics["publicBaseUrlConfigured"]:
        diagnostics["warnings"].append(
            {
                "code": "missing_public_base_url",
                "message": "PUBLIC_BASE_URL ist nicht gesetzt. Externe Links koennen auf lokalen Host zeigen.",
            }
        )

    db = None
    try:
        db = sqlite3.connect(DB_PATH)
        db.row_factory = sqlite3.Row
        admin_rows = db.execute("SELECT username, role, password_hash FROM users WHERE role IN ('superadmin', 'company-admin', 'turnstile')").fetchall()
        weak_users = [row["username"] for row in admin_rows if check_password_hash(row["password_hash"], "1234")]
        if weak_users:
            diagnostics["warnings"].append(
                {
                    "code": "default_passwords_present",
                    "message": f"Standardpasswort 1234 noch aktiv fuer: {', '.join(weak_users[:10])}",
                }
            )
    except Exception as exc:
        diagnostics["warnings"].append(
            {
                "code": "runtime_diagnostics_failed",
                "message": f"Runtime-Diagnose konnte nicht vollstaendig gelesen werden: {exc}",
            }
        )
    finally:
        if db is not None:
            db.close()

    return diagnostics


@app.get("/api/qr.png")
def qr_png():
    data = (request.args.get("data") or "").strip()
    if not data:
        return jsonify({"error": "missing_data"}), 400

    try:
        size = int(request.args.get("size") or 280)
    except ValueError:
        size = 280
    size = max(120, min(size, 1024))

    qr = qrcode.QRCode(border=1, box_size=10)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    img = img.resize((size, size))

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return Response(buffer.getvalue(), mimetype="image/png")


@app.get("/api/qr")
def qr_data_url():
    data = (request.args.get("data") or "").strip()
    if not data:
        return jsonify({"error": "missing_data"}), 400

    try:
        size = int(request.args.get("size") or 280)
    except ValueError:
        size = 280
    size = max(120, min(size, 1024))

    qr = qrcode.QRCode(border=1, box_size=10)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    img = img.resize((size, size))

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    encoded = buffer.getvalue().hex()
    # hex-to-bytes on client is simple and avoids binary transport issues in JSON.
    return jsonify({"pngHex": encoded})


@app.post("/api/login")
@require_rate_limit("login")
def login():
    def login_error(code, **extra):
        payload = {"ok": False, "error": code}
        payload.update(extra)
        return jsonify(payload)

    throttle_key = build_login_throttle_key()
    allowed, retry_after = can_attempt_login(throttle_key)
    if not allowed:
        return login_error("too_many_attempts", retryAfterSeconds=retry_after)

    payload = request.get_json(silent=True) or {}
    username = (payload.get("username") or "").strip().lower()
    password = payload.get("password") or ""
    otp_code = (payload.get("otpCode") or "").strip()
    login_scope = (payload.get("loginScope") or "auto").strip().lower()

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE lower(username) = ?", (username,)).fetchone()

    if not user or not check_password_hash(user["password_hash"], password):
        register_login_failure(throttle_key)
        log_audit("login.failed", f"Fehlgeschlagener Login fuer {username or 'unbekannt'}")
        return login_error("invalid_credentials")

    required_role_by_scope = {
        "server-admin": "superadmin",
        "company-admin": "company-admin",
        "turnstile": "turnstile",
    }
    required_role = required_role_by_scope.get(login_scope)
    if required_role and user["role"] != required_role:
        register_login_failure(throttle_key)
        log_audit("login.failed", f"Login-Typ passt nicht zu {username or 'unbekannt'}")
        return login_error("login_scope_mismatch")

    if int(user["twofa_enabled"]) == 1:
        if not otp_code:
            register_login_failure(throttle_key)
            return login_error("otp_required")
        totp = pyotp.TOTP(user["twofa_secret"])
        if not totp.verify(otp_code, valid_window=1):
            register_login_failure(throttle_key)
            return login_error("otp_invalid")

    if not is_tenant_host_valid(db, row_to_dict(user)):
        register_login_failure(throttle_key)
        return login_error("forbidden_tenant_host")

    if user["role"] != "superadmin":
        company_error = get_company_access_error(db, user["company_id"])
        if company_error:
            log_audit("login.blocked", f"Login fuer {user['username']} wegen Firmensperre blockiert", target_type="company", target_id=user["company_id"])
            return login_error(company_error["error"], companyStatus=company_error["companyStatus"], companyName=company_error["companyName"], message=company_error.get("message", ""))

    clear_login_failures(throttle_key)

    token = secrets.token_urlsafe(24)
    db.execute("DELETE FROM sessions WHERE user_id = ?", (user["id"],))
    db.execute(
        "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
        (token, user["id"], expiry_iso()),
    )
    db.commit()

    log_audit("login.success", f"Benutzer {user['username']} angemeldet", target_type="user", target_id=user["id"], actor=row_to_dict(user))

    response = jsonify({"ok": True, "token": token, "user": serialize_user(user)})
    response.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        httponly=True,
        samesite="None" if should_use_cross_site_cookie() else "Lax",
        secure=request.is_secure,
    )
    return response


@app.post("/api/logout")
@require_auth
def logout():
    get_db().execute("DELETE FROM sessions WHERE token = ?", (g.token,))
    get_db().commit()
    log_audit("login.logout", f"Benutzer {g.current_user['username']} abgemeldet", target_type="user", target_id=g.current_user["id"], actor=g.current_user)
    response = jsonify({"ok": True})
    response.delete_cookie(SESSION_COOKIE_NAME)
    return response


@app.get("/api/me")
@require_auth
def me():
    return jsonify({"user": serialize_user(g.current_user)})


@app.get("/api/session/bootstrap")
def session_bootstrap():
    auth_header = request.headers.get("Authorization", "")
    auth_token = auth_header.split(" ", 1)[1].strip() if auth_header.startswith("Bearer ") else ""
    cookie_token = request.cookies.get(SESSION_COOKIE_NAME, "")
    token = auth_token or cookie_token

    user = get_user_from_session_token(token)
    if not user:
        return jsonify({"error": "unauthorized"}), 401

    db = get_db()
    if not is_tenant_host_valid(db, user):
        return jsonify({"error": "forbidden_tenant_host"}), 403

    if user.get("role") != "superadmin":
        company_error = get_company_access_error(db, user.get("company_id"))
        if company_error:
            db.execute("DELETE FROM sessions WHERE token = ?", (token,))
            db.commit()
            return jsonify(company_error), 403

    if user.get("role") in ["superadmin", "company-admin"]:
        settings_row = db.execute("SELECT admin_ip_whitelist FROM settings WHERE id = 1").fetchone()
        whitelist = parse_ip_whitelist(settings_row["admin_ip_whitelist"] if settings_row else "")
        if whitelist and not ip_allowed(get_client_ip(), whitelist):
            return jsonify({"error": "admin_ip_not_allowed"}), 403

    db.execute("UPDATE sessions SET expires_at = ? WHERE token = ?", (expiry_iso(), token))
    db.commit()

    return jsonify({"token": token, "user": serialize_user(user)})


@app.get("/api/system/status")
@require_auth
@require_roles("superadmin")
def system_status():
    db = get_db()
    active_sessions = db.execute("SELECT COUNT(*) AS c FROM sessions WHERE expires_at >= ?", (now_iso(),)).fetchone()["c"]
    worker_sessions = db.execute("SELECT COUNT(*) AS c FROM worker_app_sessions WHERE expires_at >= ?", (now_iso(),)).fetchone()["c"]
    open_entries = db.execute(
        """
        SELECT COUNT(*) AS c
        FROM (
            SELECT access_logs.worker_id, MAX(access_logs.timestamp) AS latest_ts
            FROM access_logs
            JOIN workers ON workers.id = access_logs.worker_id
            WHERE workers.deleted_at IS NULL
            GROUP BY access_logs.worker_id
        ) latest
        JOIN access_logs ON access_logs.worker_id = latest.worker_id AND access_logs.timestamp = latest.latest_ts
        WHERE access_logs.direction = 'check-in'
        """
    ).fetchone()["c"]

    recent_issues = db.execute(
        """
        SELECT event_type, message, created_at
        FROM audit_logs
        WHERE event_type IN ('login.failed', 'security.password_changed', 'access.booked')
           OR event_type LIKE 'company.%'
           OR event_type LIKE 'worker.%'
        ORDER BY created_at DESC
        LIMIT 20
        """
    ).fetchall()

    locks = []
    now = datetime.utcnow()
    for key, state in list(failed_login_attempts.items()):
        locked_until = state.get("locked_until")
        if not locked_until:
            continue
        if locked_until <= now:
            failed_login_attempts.pop(key, None)
            continue
        locks.append(
            {
                "key": key,
                "retryAfterSeconds": int((locked_until - now).total_seconds()),
            }
        )

    session_details = db.execute(
        """
        SELECT s.last_seen, u.name, u.role, u.username
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.expires_at >= ?
        ORDER BY s.last_seen DESC
        LIMIT 20
        """,
        (now_iso(),),
    ).fetchall()

    setting = db.execute("SELECT worker_app_enabled FROM settings WHERE id = 1").fetchone()

    return jsonify(
        {
            "serverTime": now_iso(),
            "currentHost": get_request_host(),
            "currentIp": get_client_ip(),
            "activeSessions": active_sessions,
            "activeWorkerSessions": worker_sessions,
            "openEntries": open_entries,
            "loginLocks": locks[:50],
            "recentIssues": [row_to_dict(row) for row in recent_issues],
            "sessionDetails": [
                {
                    "name": row["name"],
                    "role": row["role"],
                    "username": row["username"],
                    "lastSeen": row["last_seen"],
                }
                for row in session_details
            ],
            "workerAppEnabled": int(setting["worker_app_enabled"]) == 1 if setting else True,
        }
    )


@app.get("/api/system/runtime-check")
@require_auth
@require_roles("superadmin")
def system_runtime_check():
    diagnostics = get_runtime_diagnostics()
    return jsonify({"ok": True, "serverTime": now_iso(), **diagnostics})


@app.post("/api/system/recover-admin")
def system_recover_admin():
    configured_secret = (os.getenv("BAUPASS_RECOVERY_SECRET") or "").strip()
    if not configured_secret:
        return jsonify({"ok": False, "error": "recovery_disabled"}), 503

    payload = request.get_json(silent=True) or {}
    provided_secret = (payload.get("recoverySecret") or request.headers.get("X-Recovery-Secret") or "").strip()
    if not provided_secret or not secrets.compare_digest(provided_secret, configured_secret):
        log_audit("system.recovery_failed", "Recovery-Versuch mit ungueltigem Secret")
        return jsonify({"ok": False, "error": "invalid_recovery_secret"}), 401

    username = (payload.get("username") or os.getenv("BAUPASS_RECOVERY_USERNAME") or "superadmin").strip().lower()
    new_password = payload.get("newPassword") or ""
    if len(new_password) < 8:
        return jsonify({"ok": False, "error": "password_too_short"}), 400

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE lower(username) = ?", (username,)).fetchone()
    if not user:
        return jsonify({"ok": False, "error": "user_not_found"}), 404
    if user["role"] not in {"superadmin", "company-admin", "turnstile"}:
        return jsonify({"ok": False, "error": "recovery_not_allowed_for_role"}), 403

    db.execute("UPDATE users SET password_hash = ? WHERE id = ?", (generate_password_hash(new_password), user["id"]))
    db.execute("DELETE FROM sessions WHERE user_id = ?", (user["id"],))
    db.commit()
    clear_login_failures_for_username(username)
    log_audit(
        "system.recovery_password_reset",
        f"Recovery-Passwortreset fuer {username}",
        target_type="user",
        target_id=user["id"],
    )
    return jsonify({"ok": True, "username": username, "role": user["role"]})


@app.post("/api/system/repair")
@require_auth
@require_roles("superadmin")
def system_repair():
    db = get_db()
    now = now_iso()
    db.execute("DELETE FROM sessions WHERE expires_at < ?", (now,))
    db.execute("DELETE FROM worker_app_sessions WHERE expires_at < ?", (now,))
    db.execute("DELETE FROM worker_app_tokens WHERE expires_at < ?", (now,))
    db.commit()
    failed_login_attempts.clear()
    log_audit("system.repair", "System-Reparatur ausgefuehrt (abgelaufene Sitzungen bereinigt, Login-Sperren geloescht)", actor=g.current_user)
    return jsonify({"ok": True})


@app.post("/api/me/heartbeat")
@require_auth
def heartbeat():
    db = get_db()
    db.execute("UPDATE sessions SET last_seen = ? WHERE token = ?", (now_iso(), g.token))
    db.commit()
    return jsonify({"ok": True})


@app.post("/api/me/password")
@require_auth
def change_password():
    payload = request.get_json(silent=True) or {}
    current_password = payload.get("currentPassword") or ""
    new_password = payload.get("newPassword") or ""

    if len(new_password) < 8:
        return jsonify({"error": "password_too_short"}), 400

    db = get_db()
    row = db.execute("SELECT * FROM users WHERE id = ?", (g.current_user["id"],)).fetchone()
    if not row or not check_password_hash(row["password_hash"], current_password):
        return jsonify({"error": "invalid_current_password"}), 400

    db.execute("UPDATE users SET password_hash = ? WHERE id = ?", (generate_password_hash(new_password), g.current_user["id"]))
    db.execute("DELETE FROM sessions WHERE user_id = ?", (g.current_user["id"],))
    db.commit()
    log_audit("security.password_changed", "Passwort wurde geaendert", target_type="user", target_id=g.current_user["id"], actor=g.current_user)
    return jsonify({"ok": True})


@app.get("/api/me/2fa")
@require_auth
def get_twofa_status():
    return jsonify({"enabled": int(g.current_user["twofa_enabled"]) == 1})


@app.post("/api/me/2fa/setup")
@require_auth
@require_roles("superadmin")
def setup_twofa():
    db = get_db()
    row = db.execute("SELECT * FROM users WHERE id = ?", (g.current_user["id"],)).fetchone()
    secret = row["twofa_secret"] or pyotp.random_base32()
    if not row["twofa_secret"]:
        db.execute("UPDATE users SET twofa_secret = ? WHERE id = ?", (secret, g.current_user["id"]))
        db.commit()

    issuer = "BauPass Control"
    uri = pyotp.TOTP(secret).provisioning_uri(name=row["username"], issuer_name=issuer)
    return jsonify({"secret": secret, "otpauthUri": uri, "enabled": int(row["twofa_enabled"]) == 1})


@app.post("/api/me/2fa/enable")
@require_auth
@require_roles("superadmin")
def enable_twofa():
    payload = request.get_json(silent=True) or {}
    code = (payload.get("code") or "").strip()
    db = get_db()
    row = db.execute("SELECT * FROM users WHERE id = ?", (g.current_user["id"],)).fetchone()
    secret = row["twofa_secret"]
    if not secret:
        return jsonify({"error": "twofa_not_setup"}), 400

    if not pyotp.TOTP(secret).verify(code, valid_window=1):
        return jsonify({"error": "otp_invalid"}), 400

    db.execute("UPDATE users SET twofa_enabled = 1 WHERE id = ?", (g.current_user["id"],))
    db.commit()
    log_audit("security.2fa_enabled", "2FA wurde aktiviert", target_type="user", target_id=g.current_user["id"], actor=g.current_user)
    return jsonify({"ok": True})


@app.post("/api/me/2fa/disable")
@require_auth
@require_roles("superadmin")
def disable_twofa():
    payload = request.get_json(silent=True) or {}
    code = (payload.get("code") or "").strip()
    db = get_db()
    row = db.execute("SELECT * FROM users WHERE id = ?", (g.current_user["id"],)).fetchone()
    secret = row["twofa_secret"]

    if int(row["twofa_enabled"]) == 1 and not pyotp.TOTP(secret).verify(code, valid_window=1):
        return jsonify({"error": "otp_invalid"}), 400

    db.execute("UPDATE users SET twofa_enabled = 0 WHERE id = ?", (g.current_user["id"],))
    db.commit()
    log_audit("security.2fa_disabled", "2FA wurde deaktiviert", target_type="user", target_id=g.current_user["id"], actor=g.current_user)
    return jsonify({"ok": True})


@app.get("/api/settings")
@require_auth
def get_settings():
    row = get_db().execute("SELECT * FROM settings WHERE id = 1").fetchone()
    return jsonify(
        {
            "platformName": row["platform_name"],
            "operatorName": row["operator_name"],
            "turnstileEndpoint": row["turnstile_endpoint"],
            "rentalModel": row["rental_model"],
            "invoiceLogoData": row["invoice_logo_data"],
            "invoicePrimaryColor": row["invoice_primary_color"],
            "invoiceAccentColor": row["invoice_accent_color"],
            "smtpHost": row["smtp_host"],
            "smtpPort": row["smtp_port"],
            "smtpUsername": row["smtp_username"],
            "smtpPassword": row["smtp_password"],
            "smtpSenderEmail": row["smtp_sender_email"],
            "smtpSenderName": row["smtp_sender_name"],
            "smtpUseTls": int(row["smtp_use_tls"]) == 1,
            "adminIpWhitelist": row["admin_ip_whitelist"],
            "enforceTenantDomain": int(row["enforce_tenant_domain"]) == 1,
            "workerAppEnabled": int(row["worker_app_enabled"]) == 1,
        }
    )


@app.put("/api/settings")
@require_auth
@require_roles("superadmin")
def update_settings():
    payload = request.get_json(silent=True) or {}
    get_db().execute(
        """
        UPDATE settings
        SET platform_name = ?, operator_name = ?, turnstile_endpoint = ?, rental_model = ?,
            invoice_logo_data = ?, invoice_primary_color = ?, invoice_accent_color = ?,
            smtp_host = ?, smtp_port = ?, smtp_username = ?, smtp_password = ?,
            smtp_sender_email = ?, smtp_sender_name = ?, smtp_use_tls = ?,
            admin_ip_whitelist = ?, enforce_tenant_domain = ?, worker_app_enabled = ?
        WHERE id = 1
        """,
        (
            payload.get("platformName", "BauPass Control"),
            payload.get("operatorName", "Deine Betriebsfirma"),
            payload.get("turnstileEndpoint", ""),
            payload.get("rentalModel", "tageskarte"),
            payload.get("invoiceLogoData", ""),
            payload.get("invoicePrimaryColor", "#0f4c5c"),
            payload.get("invoiceAccentColor", "#e36414"),
            payload.get("smtpHost", ""),
            int(payload.get("smtpPort", 587) or 587),
            payload.get("smtpUsername", ""),
            payload.get("smtpPassword", ""),
            payload.get("smtpSenderEmail", ""),
            payload.get("smtpSenderName", "BauPass Control"),
            1 if payload.get("smtpUseTls", True) else 0,
            payload.get("adminIpWhitelist", ""),
            1 if payload.get("enforceTenantDomain", False) else 0,
            1 if payload.get("workerAppEnabled", True) else 0,
        ),
    )
    get_db().commit()
    log_audit("settings.updated", "Systemeinstellungen wurden aktualisiert", actor=g.current_user)
    return get_settings()


@app.get("/api/companies")
@require_auth
def list_companies():
    include_deleted = request.args.get("includeDeleted", "0") == "1"
    clause, params = visible_company_clause(g.current_user)
    if include_deleted:
        where = clause
    else:
        where = f"{clause}{' AND' if clause else ' WHERE'} deleted_at IS NULL"

    rows = get_db().execute(f"SELECT * FROM companies{where} ORDER BY name", params).fetchall()
    return jsonify([row_to_dict(row) for row in rows])


@app.get("/api/subcompanies")
@require_auth
def list_subcompanies():
    include_deleted = request.args.get("includeDeleted", "0") == "1"
    requested_company_id = (request.args.get("companyId") or "").strip()
    user = g.current_user

    conditions = []
    params = []

    if user["role"] == "superadmin":
        if requested_company_id:
            conditions.append("company_id = ?")
            params.append(requested_company_id)
    else:
        conditions.append("company_id = ?")
        params.append(user.get("company_id"))

    if not include_deleted:
        conditions.append("deleted_at IS NULL")

    where_clause = f" WHERE {' AND '.join(conditions)}" if conditions else ""
    rows = get_db().execute(f"SELECT * FROM subcompanies{where_clause} ORDER BY name", params).fetchall()
    return jsonify([row_to_dict(row) for row in rows])


@app.post("/api/subcompanies")
@require_auth
@require_roles("superadmin", "company-admin")
def create_subcompany():
    payload = request.get_json(silent=True) or {}
    user = g.current_user
    company_id = (payload.get("companyId") or user.get("company_id") or "").strip()
    name = (payload.get("name") or "").strip()
    contact = (payload.get("contact") or "").strip()

    if not company_id:
        return jsonify({"error": "missing_company"}), 400
    if user["role"] != "superadmin" and company_id != user.get("company_id"):
        return jsonify({"error": "forbidden_company"}), 403
    if not name:
        return jsonify({"error": "missing_name"}), 400

    db = get_db()
    company = db.execute("SELECT * FROM companies WHERE id = ?", (company_id,)).fetchone()
    if not company or company["deleted_at"]:
        return jsonify({"error": "company_not_available"}), 400

    existing = db.execute(
        "SELECT * FROM subcompanies WHERE company_id = ? AND lower(name) = lower(?) AND deleted_at IS NULL",
        (company_id, name),
    ).fetchone()
    if existing:
        return jsonify({"error": "subcompany_exists"}), 400

    subcompany_id = f"sub-{secrets.token_hex(6)}"
    db.execute(
        "INSERT INTO subcompanies (id, company_id, name, contact, status, deleted_at) VALUES (?, ?, ?, ?, ?, NULL)",
        (subcompany_id, company_id, name, contact, "aktiv"),
    )
    db.commit()
    log_audit(
        "subcompany.created",
        f"Subunternehmen {name} wurde angelegt",
        target_type="subcompany",
        target_id=subcompany_id,
        company_id=company_id,
        actor=user,
    )

    row = db.execute("SELECT * FROM subcompanies WHERE id = ?", (subcompany_id,)).fetchone()
    return jsonify(row_to_dict(row)), 201


@app.post("/api/companies")
@require_auth
@require_roles("superadmin")
def create_company():
    payload = request.get_json(silent=True) or {}
    company_id = f"cmp-{secrets.token_hex(6)}"

    get_db().execute(
        "INSERT INTO companies (id, name, contact, billing_email, access_host, plan, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            company_id,
            payload.get("name", "Neue Firma"),
            payload.get("contact", ""),
            payload.get("billingEmail", ""),
            (payload.get("accessHost") or payload.get("access_host") or "").strip().lower(),
            normalize_company_plan(payload.get("plan", "tageskarte")),
            payload.get("status", "aktiv"),
        ),
    )

    username_base = "".join(c for c in payload.get("name", "firma").lower() if c.isalnum())[:12] or "firma"
    username = username_base
    suffix = 1
    db = get_db()
    while db.execute("SELECT 1 FROM users WHERE username = ?", (username,)).fetchone():
        username = f"{username_base}{suffix}"
        suffix += 1

    db.execute(
        "INSERT INTO users (id, username, password_hash, name, role, company_id) VALUES (?, ?, ?, ?, ?, ?)",
        (
            f"usr-{secrets.token_hex(6)}",
            username,
            generate_password_hash("1234"),
            f"{payload.get('name', 'Firma')} Admin",
            "company-admin",
            company_id,
        ),
    )
    db.commit()
    log_audit("company.created", f"Firma {payload.get('name', 'Firma')} wurde angelegt", target_type="company", target_id=company_id, company_id=company_id, actor=g.current_user)

    row = db.execute("SELECT * FROM companies WHERE id = ?", (company_id,)).fetchone()
    return (
        jsonify(
            {
                "company": row_to_dict(row),
                "adminCredentials": {
                    "username": username,
                    "password": "1234",
                },
            }
        ),
        201,
    )


@app.post("/api/demo-seed")
@require_auth
@require_roles("superadmin", "company-admin")
def demo_seed():
    payload = request.get_json(silent=True) or {}
    company_id = payload.get("companyId") or g.current_user.get("company_id")
    mode = (payload.get("mode") or "replace").strip().lower()
    include_invoices = int(payload.get("includeInvoices") or 0) == 1
    include_access_logs = int(payload.get("includeAccessLogs") or 1) == 1
    include_overdue_example = int(payload.get("includeOverdueExample") or 1) == 1

    if mode not in {"replace", "append"}:
        return jsonify({"error": "invalid_mode"}), 400

    db = get_db()
    if g.current_user["role"] == "superadmin" and not company_id:
        first_company = db.execute("SELECT id FROM companies WHERE deleted_at IS NULL ORDER BY name LIMIT 1").fetchone()
        company_id = (first_company["id"] if first_company else "") or ""
        if not company_id:
            company_id = "cmp-default"
            db.execute(
                "INSERT OR IGNORE INTO companies (id, name, contact, billing_email, access_host, plan, status, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)",
                (company_id, "Muster Bau GmbH", "Sabine Keller", "", "", "professional", "test"),
            )

    if g.current_user["role"] != "superadmin" and company_id != g.current_user.get("company_id"):
        return jsonify({"error": "forbidden_company"}), 403

    if mode == "replace":
        db.execute("DELETE FROM access_logs WHERE worker_id IN (SELECT id FROM workers WHERE company_id = ?)", (company_id,))
        db.execute("DELETE FROM workers WHERE company_id = ?", (company_id,))
        db.execute("DELETE FROM subcompanies WHERE company_id = ?", (company_id,))
        if include_invoices:
            db.execute("DELETE FROM invoices WHERE company_id = ?", (company_id,))

    subcompanies = [
        (f"sub-{secrets.token_hex(6)}", company_id, "Demir Montage", "Ali Demir", "aktiv", None),
        (f"sub-{secrets.token_hex(6)}", company_id, "Lehmann Kranservice", "Mara Lehmann", "aktiv", None),
    ]
    db.executemany(
        "INSERT INTO subcompanies (id, company_id, name, contact, status, deleted_at) VALUES (?, ?, ?, ?, ?, ?)",
        subcompanies,
    )

    workers = [
        {
            "id": f"wrk-{secrets.token_hex(6)}",
            "company_id": company_id,
            "subcompany_id": subcompanies[0][0],
            "first_name": "Ali",
            "last_name": "Demir",
            "insurance_number": "12 345678 A 111",
            "role": "Kranfuehrer",
            "site": "Neubau Mitte",
            "valid_until": "2026-12-31",
            "status": "aktiv",
            "photo_data": "",
            "badge_id": "BP-AD-DEM01",
        },
        {
            "id": f"wrk-{secrets.token_hex(6)}",
            "company_id": company_id,
            "subcompany_id": subcompanies[1][0],
            "first_name": "Mara",
            "last_name": "Lehmann",
            "insurance_number": "12 345678 A 222",
            "role": "Polierin",
            "site": "Neubau Mitte",
            "valid_until": "2026-12-31",
            "status": "aktiv",
            "photo_data": "",
            "badge_id": "BP-ML-DEM02",
        },
    ]

    for worker in workers:
        db.execute(
            """
            INSERT INTO workers (
                id, company_id, subcompany_id, first_name, last_name, insurance_number, role, site, valid_until, status, photo_data, badge_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                worker["id"],
                worker["company_id"],
                worker["subcompany_id"],
                worker["first_name"],
                worker["last_name"],
                worker["insurance_number"],
                worker["role"],
                worker["site"],
                worker["valid_until"],
                worker["status"],
                worker["photo_data"],
                worker["badge_id"],
            ),
        )

    access_logs_created = 0
    if include_access_logs:
        db.execute(
            "INSERT INTO access_logs (id, worker_id, direction, gate, note, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
            (
                f"log-{secrets.token_hex(6)}",
                workers[0]["id"],
                "check-in",
                "Drehkreuz Nord",
                "Fruehschicht",
                now_iso(),
            ),
        )
        db.execute(
            "INSERT INTO access_logs (id, worker_id, direction, gate, note, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
            (
                f"log-{secrets.token_hex(6)}",
                workers[1]["id"],
                "check-in",
                "Drehkreuz Sued",
                "Spaetschicht",
                now_iso(),
            ),
        )
        access_logs_created = 2

    invoices_created = 0
    if include_invoices:
        company = db.execute("SELECT * FROM companies WHERE id = ?", (company_id,)).fetchone()
        created_by = g.current_user["id"]
        base_date = datetime.utcnow().date()
        invoice_examples = [
            {
                "number": f"RE-{base_date.year}-{secrets.token_hex(2).upper()}",
                "offset": -28,
                "due_offset": -14,
                "status": "overdue" if include_overdue_example else "sent",
                "desc": "Monatliche Baustellenplattform",
                "total": 119.0,
                "period": "Demo-Monat 1",
                "reminder_stage": 3 if include_overdue_example else 1,
            },
            {
                "number": f"RE-{base_date.year}-{secrets.token_hex(2).upper()}",
                "offset": -7,
                "due_offset": 7,
                "status": "sent",
                "desc": "Mitarbeiterverwaltung + Zutritt",
                "total": 89.0,
                "period": "Demo-Monat 2",
                "reminder_stage": 1,
            },
        ]
        for item in invoice_examples:
            invoice_date = (base_date + timedelta(days=item["offset"])).isoformat()
            due_date = (base_date + timedelta(days=item["due_offset"])).isoformat()
            net_amount = round(item["total"] / 1.19, 2)
            vat_amount = round(item["total"] - net_amount, 2)
            db.execute(
                """
                INSERT INTO invoices (
                    id, invoice_number, company_id, recipient_email, invoice_date, invoice_period, description,
                    net_amount, vat_rate, vat_amount, total_amount, status, error_message, sent_at,
                    rendered_html, created_by_user_id, created_at, due_date, paid_at,
                    auto_suspend_triggered_at, reminder_stage, last_reminder_sent_at, last_reminder_error
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    f"inv-{secrets.token_hex(6)}",
                    item["number"],
                    company_id,
                    (company["billing_email"] or "buchhaltung@demo-firma.de") if company else "buchhaltung@demo-firma.de",
                    invoice_date,
                    item["period"],
                    item["desc"],
                    net_amount,
                    19.0,
                    vat_amount,
                    item["total"],
                    item["status"],
                    "",
                    now_iso(),
                    f"<html><body><h1>{item['number']}</h1></body></html>",
                    created_by,
                    now_iso(),
                    due_date,
                    None,
                    None,
                    item["reminder_stage"],
                    None,
                    "",
                ),
            )
            invoices_created += 1

    db.commit()
    log_audit(
        "demo.seed",
        f"Demo-Daten geladen (mode={mode}, workers={len(workers)}, logs={access_logs_created}, invoices={invoices_created})",
        target_type="company",
        target_id=company_id,
        company_id=company_id,
        actor=g.current_user,
    )

    return jsonify(
        {
            "ok": True,
            "mode": mode,
            "workersCreated": len(workers),
            "accessLogsCreated": access_logs_created,
            "invoicesCreated": invoices_created,
            "companyId": company_id,
        }
    )


@app.get("/api/workers")
@require_auth
def list_workers():
    include_deleted = request.args.get("includeDeleted", "0") == "1"
    clause, params = visible_worker_clause(g.current_user)
    where = clause if include_deleted else f"{clause}{' AND' if clause else ' WHERE'} deleted_at IS NULL"
    rows = get_db().execute(f"SELECT * FROM workers{where} ORDER BY last_name, first_name", params).fetchall()
    return jsonify([serialize_worker_record(row) for row in rows])


@app.get("/api/workers/export.csv")
@require_auth
@require_roles("superadmin", "company-admin")
def export_workers_csv():
    include_deleted = request.args.get("includeDeleted", "0") == "1"
    where_clause, params = visible_worker_clause(g.current_user, prefix="workers.")
    if not include_deleted:
        where_clause = f"{where_clause}{' AND' if where_clause else ' WHERE'} workers.deleted_at IS NULL"

    rows = get_db().execute(
        f"""
        SELECT workers.*, companies.name AS company_name, subcompanies.name AS subcompany_name
        FROM workers
        JOIN companies ON companies.id = workers.company_id
        LEFT JOIN subcompanies ON subcompanies.id = workers.subcompany_id
        {where_clause}
        ORDER BY workers.last_name, workers.first_name
        """,
        params,
    ).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "id",
            "company_id",
            "company_name",
            "subcompany_id",
            "subcompany_name",
            "first_name",
            "last_name",
            "worker_type",
            "insurance_number",
            "role",
            "site",
            "valid_until",
            "visitor_company",
            "visit_purpose",
            "host_name",
            "visit_end_at",
            "status",
            "badge_id",
            "physical_card_id",
            "deleted_at",
        ]
    )
    for row in rows:
        writer.writerow(
            [
                row["id"],
                row["company_id"],
                row["company_name"],
                row["subcompany_id"],
                row["subcompany_name"],
                row["first_name"],
                row["last_name"],
                row["worker_type"],
                row["insurance_number"],
                row["role"],
                row["site"],
                row["valid_until"],
                row["visitor_company"],
                row["visit_purpose"],
                row["host_name"],
                row["visit_end_at"],
                row["status"],
                row["badge_id"],
                row["physical_card_id"],
                row["deleted_at"],
            ]
        )

    return Response(
        output.getvalue(),
        mimetype="application/octet-stream",
        headers={"Content-Disposition": 'attachment; filename="mitarbeiterliste.csv"'},
    )


@app.get("/api/workers/export.pdf")
@require_auth
@require_roles("superadmin", "company-admin", "turnstile")
def export_workers_pdf():
    include_deleted = request.args.get("includeDeleted", "0") == "1"
    where_clause, params = visible_worker_clause(g.current_user, prefix="workers.")
    if not include_deleted:
        where_clause = f"{where_clause}{' AND' if where_clause else ' WHERE'} workers.deleted_at IS NULL"

    rows = get_db().execute(
        f"""
        SELECT workers.*, companies.name AS company_name, subcompanies.name AS subcompany_name
        FROM workers
        JOIN companies ON companies.id = workers.company_id
        LEFT JOIN subcompanies ON subcompanies.id = workers.subcompany_id
        {where_clause}
        ORDER BY workers.last_name, workers.first_name
        """,
        params,
    ).fetchall()

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
    except Exception:
        return jsonify({"error": "pdf_dependency_missing", "message": "Bitte reportlab installieren."}), 503

    buffer = io.BytesIO()
    page_width, page_height = A4
    pdf = canvas.Canvas(buffer, pagesize=A4)

    y = page_height - 42
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(36, y, "BauPass - Mitarbeiterliste")
    y -= 16
    pdf.setFont("Helvetica", 9)
    pdf.drawString(36, y, f"Erstellt am: {datetime.now().strftime('%d.%m.%Y %H:%M')}")
    y -= 22
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(36, y, "Name")
    pdf.drawString(200, y, "Firma")
    pdf.drawString(340, y, "Subunternehmen")
    pdf.drawString(470, y, "Status")
    y -= 12
    pdf.line(36, y, page_width - 36, y)
    y -= 14

    pdf.setFont("Helvetica", 9)
    for row in rows:
        if y < 48:
            pdf.showPage()
            y = page_height - 44
            pdf.setFont("Helvetica-Bold", 9)
            pdf.drawString(36, y, "Name")
            pdf.drawString(200, y, "Firma")
            pdf.drawString(340, y, "Subunternehmen")
            pdf.drawString(470, y, "Status")
            y -= 12
            pdf.line(36, y, page_width - 36, y)
            y -= 14
            pdf.setFont("Helvetica", 9)

        full_name = f"{(row['last_name'] or '').strip()}, {(row['first_name'] or '').strip()}".strip(", ")
        pdf.drawString(36, y, full_name[:32])
        pdf.drawString(200, y, str(row["company_name"] or "-")[:24])
        pdf.drawString(340, y, str(row["subcompany_name"] or "-")[:21])
        pdf.drawString(470, y, str(row["status"] or "-")[:11])
        y -= 13

    if not rows:
        pdf.drawString(36, y, "Keine Mitarbeiter gefunden.")

    pdf.save()
    buffer.seek(0)
    filename = f"mitarbeiterliste-{datetime.now().strftime('%Y-%m-%d')}.pdf"
    return Response(
        buffer.getvalue(),
        mimetype="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/api/workers")
@require_auth
@require_roles("superadmin", "company-admin")
def create_worker():
    payload = request.get_json(silent=True) or {}
    user = g.current_user
    company_id = payload.get("companyId") or user.get("company_id")
    db = get_db()

    if user["role"] != "superadmin" and company_id != user.get("company_id"):
        return jsonify({"error": "forbidden_company"}), 403

    company = db.execute("SELECT * FROM companies WHERE id = ?", (company_id,)).fetchone()
    if not company or company["deleted_at"]:
        return jsonify({"error": "company_not_available"}), 400

    try:
        subcompany_id = resolve_subcompany_id(db, company_id, payload.get("subcompanyId"))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    photo_data = (payload.get("photoData") or "").strip()
    if not photo_data:
        return jsonify({"error": "photo_required"}), 400

    worker_type = normalize_worker_type(payload.get("workerType"))
    visitor_company = (payload.get("visitorCompany") or "").strip()
    visit_purpose = (payload.get("visitPurpose") or "").strip()
    host_name = (payload.get("hostName") or "").strip()
    visit_end_at = parse_datetime_local_to_utc_iso(payload.get("visitEndAt"))

    if worker_type == "visitor":
        if not visit_purpose:
            return jsonify({"error": "visit_purpose_required"}), 400
        if not visitor_company:
            return jsonify({"error": "visitor_company_required"}), 400
        if not host_name:
            return jsonify({"error": "host_name_required"}), 400
        if not visit_end_at:
            return jsonify({"error": "visit_end_required"}), 400

    badge_pin_hash = ""
    if worker_type != "visitor":
        try:
            badge_pin = validate_badge_pin_or_raise(payload.get("badgePin"))
        except ValueError as error:
            return jsonify({"error": str(error), "message": "Badge-PIN muss aus 4 bis 8 Ziffern bestehen."}), 400
        badge_pin_hash = generate_password_hash(badge_pin)

    physical_card_id = normalize_physical_card_id(payload.get("physicalCardId"))
    try:
        ensure_unique_physical_card_id_or_raise(db, physical_card_id)
    except ValueError as error:
        return jsonify({"error": str(error), "message": "Diese Karten-ID ist bereits einem anderen Mitarbeiter zugeordnet."}), 409

    worker_id = f"wrk-{secrets.token_hex(6)}"
    db.execute(
        """
        INSERT INTO workers (
            id, company_id, subcompany_id, first_name, last_name, insurance_number, worker_type, role, site, valid_until, visitor_company, visit_purpose, host_name, visit_end_at, status, photo_data, badge_id, badge_pin_hash, physical_card_id, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            worker_id,
            company_id,
            subcompany_id,
            payload.get("firstName", ""),
            payload.get("lastName", ""),
            payload.get("insuranceNumber", "") if worker_type != "visitor" else "",
            worker_type,
            payload.get("role", "") if worker_type != "visitor" else (payload.get("role") or "Besucher"),
            payload.get("site", ""),
            payload.get("validUntil", ""),
            visitor_company,
            visit_purpose,
            host_name,
            visit_end_at,
            payload.get("status", "aktiv"),
            photo_data,
            payload.get("badgeId", f"{'VS' if worker_type == 'visitor' else 'BP'}-{secrets.token_hex(3).upper()}"),
            badge_pin_hash,
            physical_card_id,
            None,
        ),
    )
    db.commit()
    log_audit("worker.created", f"Mitarbeiter {payload.get('firstName', '')} {payload.get('lastName', '')} erstellt", target_type="worker", target_id=worker_id, company_id=company_id, actor=g.current_user)
    row = db.execute("SELECT * FROM workers WHERE id = ?", (worker_id,)).fetchone()
    return jsonify(serialize_worker_record(row)), 201


@app.put("/api/workers/<worker_id>")
@require_auth
@require_roles("superadmin", "company-admin")
def update_worker(worker_id):
    payload = request.get_json(silent=True) or {}
    db = get_db()
    worker = db.execute("SELECT * FROM workers WHERE id = ?", (worker_id,)).fetchone()
    if not worker:
        return jsonify({"error": "worker_not_found"}), 404

    if g.current_user["role"] != "superadmin" and worker["company_id"] != g.current_user.get("company_id"):
        return jsonify({"error": "forbidden_worker"}), 403

    if worker["deleted_at"]:
        return jsonify({"error": "worker_deleted"}), 400

    next_company_id = payload.get("companyId", worker["company_id"])
    if g.current_user["role"] != "superadmin" and next_company_id != g.current_user.get("company_id"):
        return jsonify({"error": "forbidden_company"}), 403

    company = db.execute("SELECT * FROM companies WHERE id = ?", (next_company_id,)).fetchone()
    if not company or company["deleted_at"]:
        return jsonify({"error": "company_not_available"}), 400

    try:
        subcompany_id = resolve_subcompany_id(db, next_company_id, payload.get("subcompanyId", worker["subcompany_id"]))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    updated_photo_data = payload.get("photoData", worker["photo_data"])
    updated_photo_data = (updated_photo_data or "").strip()
    if not updated_photo_data:
        return jsonify({"error": "photo_required"}), 400

    next_physical_card_id = normalize_physical_card_id(payload.get("physicalCardId", worker["physical_card_id"]))
    try:
        ensure_unique_physical_card_id_or_raise(db, next_physical_card_id, worker_id_to_exclude=worker_id)
    except ValueError as error:
        return jsonify({"error": str(error), "message": "Diese Karten-ID ist bereits einem anderen Mitarbeiter zugeordnet."}), 409

    worker_type = normalize_worker_type(payload.get("workerType", worker["worker_type"]))
    visitor_company = (payload.get("visitorCompany", worker["visitor_company"]) or "").strip()
    visit_purpose = (payload.get("visitPurpose", worker["visit_purpose"]) or "").strip()
    host_name = (payload.get("hostName", worker["host_name"]) or "").strip()
    visit_end_at = parse_datetime_local_to_utc_iso(payload.get("visitEndAt", worker["visit_end_at"])) if payload.get("visitEndAt", worker["visit_end_at"]) else ""
    if worker_type == "visitor":
        if not visit_purpose:
            return jsonify({"error": "visit_purpose_required"}), 400
        if not visitor_company:
            return jsonify({"error": "visitor_company_required"}), 400
        if not host_name:
            return jsonify({"error": "host_name_required"}), 400
        if not visit_end_at:
            return jsonify({"error": "visit_end_required"}), 400

    next_badge_pin_hash = worker["badge_pin_hash"] or ""
    raw_badge_pin = payload.get("badgePin")
    if worker_type != "visitor" and raw_badge_pin is not None:
        normalized_candidate_pin = normalize_badge_pin(raw_badge_pin)
        if normalized_candidate_pin:
            try:
                validated_pin = validate_badge_pin_or_raise(normalized_candidate_pin)
            except ValueError as error:
                return jsonify({"error": str(error), "message": "Badge-PIN muss aus 4 bis 8 Ziffern bestehen."}), 400
            next_badge_pin_hash = generate_password_hash(validated_pin)
        elif not next_badge_pin_hash:
            return jsonify({"error": "badge_pin_required", "message": "Bitte eine Badge-PIN fuer diesen Mitarbeiter setzen."}), 400
    if worker_type != "visitor" and not next_badge_pin_hash:
        return jsonify({"error": "badge_pin_required", "message": "Bitte eine Badge-PIN fuer diesen Mitarbeiter setzen."}), 400

    db.execute(
        """
        UPDATE workers
        SET company_id = ?, subcompany_id = ?, first_name = ?, last_name = ?, insurance_number = ?, worker_type = ?, role = ?, site = ?, valid_until = ?, visitor_company = ?, visit_purpose = ?, host_name = ?, visit_end_at = ?, status = ?, photo_data = ?, badge_pin_hash = ?, physical_card_id = ?
        WHERE id = ?
        """,
        (
            next_company_id,
            subcompany_id,
            payload.get("firstName", worker["first_name"]),
            payload.get("lastName", worker["last_name"]),
            payload.get("insuranceNumber", worker["insurance_number"]) if worker_type != "visitor" else "",
            worker_type,
            payload.get("role", worker["role"]) if worker_type != "visitor" else (payload.get("role") or visitor_company or "Besucher"),
            payload.get("site", worker["site"]),
            payload.get("validUntil", worker["valid_until"]),
            visitor_company,
            visit_purpose,
            host_name,
            visit_end_at,
            payload.get("status", worker["status"]),
            updated_photo_data,
            next_badge_pin_hash if worker_type != "visitor" else "",
            next_physical_card_id,
            worker_id,
        ),
    )
    db.commit()
    log_audit("worker.updated", f"Mitarbeiter {worker_id} aktualisiert", target_type="worker", target_id=worker_id, company_id=worker["company_id"], actor=g.current_user)
    return jsonify({"ok": True})


@app.delete("/api/workers/<worker_id>")
@require_auth
@require_roles("superadmin", "company-admin")
def delete_worker(worker_id):
    db = get_db()
    worker = db.execute("SELECT * FROM workers WHERE id = ?", (worker_id,)).fetchone()
    if not worker:
        return jsonify({"error": "worker_not_found"}), 404

    if g.current_user["role"] != "superadmin" and worker["company_id"] != g.current_user.get("company_id"):
        return jsonify({"error": "forbidden_worker"}), 403

    db.execute("UPDATE workers SET deleted_at = ? WHERE id = ?", (now_iso(), worker_id))
    db.commit()
    log_audit("worker.deleted", f"Mitarbeiter {worker_id} geloescht", target_type="worker", target_id=worker_id, company_id=worker["company_id"], actor=g.current_user)
    return jsonify({"ok": True})


@app.post("/api/workers/<worker_id>/restore")
@require_auth
@require_roles("superadmin", "company-admin")
def restore_worker(worker_id):
    db = get_db()
    worker = db.execute("SELECT * FROM workers WHERE id = ?", (worker_id,)).fetchone()
    if not worker:
        return jsonify({"error": "worker_not_found"}), 404

    if g.current_user["role"] != "superadmin" and worker["company_id"] != g.current_user.get("company_id"):
        return jsonify({"error": "forbidden_worker"}), 403

    db.execute("UPDATE workers SET deleted_at = NULL WHERE id = ?", (worker_id,))
    db.commit()
    log_audit("worker.restored", f"Mitarbeiter {worker_id} wiederhergestellt", target_type="worker", target_id=worker_id, company_id=worker["company_id"], actor=g.current_user)
    return jsonify({"ok": True})


@app.post("/api/workers/<worker_id>/reset-pin")
@require_auth
@require_roles("superadmin", "company-admin")
def reset_worker_pin(worker_id):
    payload = request.get_json(silent=True) or {}
    db = get_db()
    worker = db.execute("SELECT * FROM workers WHERE id = ?", (worker_id,)).fetchone()
    if not worker:
        return jsonify({"error": "worker_not_found"}), 404
    if g.current_user["role"] != "superadmin" and worker["company_id"] != g.current_user.get("company_id"):
        return jsonify({"error": "forbidden_worker"}), 403
    if worker["deleted_at"]:
        return jsonify({"error": "worker_deleted"}), 400
    if worker["badge_id"].upper().startswith("VS"):
        return jsonify({"error": "visitor_no_pin", "message": "Besucher haben keine Badge-PIN."}), 400

    raw_pin = normalize_badge_pin(payload.get("newPin", ""))
    if not raw_pin:
        return jsonify({"error": "missing_pin", "message": "Bitte eine neue PIN angeben."}), 400
    try:
        validated_pin = validate_badge_pin_or_raise(raw_pin)
    except ValueError as error:
        return jsonify({"error": "invalid_pin", "message": str(error)}), 400

    new_hash = generate_password_hash(validated_pin)
    db.execute("UPDATE workers SET badge_pin_hash = ? WHERE id = ?", (new_hash, worker_id))
    db.commit()
    log_audit(
        "worker.pin_reset",
        f"Badge-PIN fuer {worker['first_name']} {worker['last_name']} (Badge {worker['badge_id']}) wurde zurueckgesetzt",
        target_type="worker", target_id=worker_id, company_id=worker["company_id"], actor=g.current_user
    )
    return jsonify({"ok": True})


def build_worker_app_access_payload(db, worker_id, actor_user):
    worker = db.execute("SELECT * FROM workers WHERE id = ?", (worker_id,)).fetchone()
    if not worker:
        return None, (jsonify({"error": "worker_not_found"}), 404)

    if actor_user["role"] != "superadmin" and worker["company_id"] != actor_user.get("company_id"):
        return None, (jsonify({"error": "forbidden_worker"}), 403)

    if worker["deleted_at"]:
        return None, (jsonify({"error": "worker_deleted"}), 400)

    if worker_visit_has_expired(worker):
        return None, (jsonify({"error": "visitor_visit_expired", "message": "Diese Besucherkarte ist zeitlich abgelaufen."}), 400)

    now = now_iso()
    db.execute(
        "UPDATE worker_app_tokens SET revoked_at = ? WHERE worker_id = ? AND revoked_at IS NULL AND expires_at >= ?",
        (now, worker_id, now),
    )

    access_token = secrets.token_urlsafe(32)
    access_expires_at = resolve_worker_access_token_expiry_iso(worker)
    db.execute(
        "INSERT INTO worker_app_tokens (token, worker_id, expires_at, revoked_at, created_by_user_id) VALUES (?, ?, ?, NULL, ?)",
        (access_token, worker_id, access_expires_at, actor_user["id"]),
    )
    db.commit()

    link = f"{get_public_base_url()}/worker.html?access={access_token}"
    return {
        "accessToken": access_token,
        "link": link,
        "created": True,
        "oneTime": True,
        "accessExpiresAt": access_expires_at,
        "workerId": worker_id,
    }, None


def serialize_worker_for_app(worker):
    return {
        "id": worker["id"],
        "subcompanyId": worker["subcompany_id"],
        "firstName": worker["first_name"],
        "lastName": worker["last_name"],
        "workerType": normalize_worker_type(worker["worker_type"]),
        "role": worker["role"],
        "site": worker["site"],
        "validUntil": worker["valid_until"],
        "visitorCompany": worker["visitor_company"],
        "visitPurpose": worker["visit_purpose"],
        "hostName": worker["host_name"],
        "visitEndAt": worker["visit_end_at"],
        "status": worker["status"],
        "photoData": worker["photo_data"],
        "badgeId": worker["badge_id"],
    }


def normalize_badge_pin(value):
    return re.sub(r"\s+", "", str(value or "").strip())


def validate_badge_pin_or_raise(pin_value):
    normalized_pin = normalize_badge_pin(pin_value)
    if not re.fullmatch(r"\d{4,8}", normalized_pin):
        raise ValueError("invalid_badge_pin")
    return normalized_pin


def normalize_physical_card_id(value):
    normalized = str(value or "").strip().upper()
    return normalized or None


def ensure_unique_physical_card_id_or_raise(db, physical_card_id, worker_id_to_exclude=None):
    if not physical_card_id:
        return
    if worker_id_to_exclude:
        duplicate = db.execute(
            """
            SELECT id
            FROM workers
            WHERE physical_card_id = ? AND id != ? AND deleted_at IS NULL
            LIMIT 1
            """,
            (physical_card_id, worker_id_to_exclude),
        ).fetchone()
    else:
        duplicate = db.execute(
            """
            SELECT id
            FROM workers
            WHERE physical_card_id = ? AND deleted_at IS NULL
            LIMIT 1
            """,
            (physical_card_id,),
        ).fetchone()
    if duplicate:
        raise ValueError("duplicate_physical_card_id")


def create_access_log_entry(db, worker_id, direction, gate, note, timestamp_value=None):
    log_id = f"log-{secrets.token_hex(6)}"
    db.execute(
        "INSERT INTO access_logs (id, worker_id, direction, gate, note, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
        (
            log_id,
            worker_id,
            direction,
            gate,
            note,
            timestamp_value or now_iso(),
        ),
    )
    return log_id


def create_worker_app_session(db, worker):
    session_token = secrets.token_urlsafe(28)
    expires_at = resolve_worker_session_expiry_iso(worker)
    db.execute(
        "INSERT INTO worker_app_sessions (token, worker_id, expires_at) VALUES (?, ?, ?)",
        (session_token, worker["id"], expires_at),
    )
    db.commit()
    return {
        "token": session_token,
        "worker": serialize_worker_for_app(worker),
        "sessionExpiresAt": expires_at,
        "cardType": normalize_worker_type(worker["worker_type"]),
    }


@app.get("/api/workers/<worker_id>/app-access")
@require_auth
@require_roles("superadmin", "company-admin")
def get_worker_app_access(worker_id):
    payload, error_response = build_worker_app_access_payload(get_db(), worker_id, g.current_user)
    if error_response:
        return error_response
    return jsonify(payload)


@app.post("/api/workers/<worker_id>/app-access")
@require_auth
@require_roles("superadmin", "company-admin")
def create_worker_app_access(worker_id):
    db = get_db()
    payload, error_response = build_worker_app_access_payload(db, worker_id, g.current_user)
    if error_response:
        return error_response
    worker = db.execute("SELECT * FROM workers WHERE id = ?", (worker_id,)).fetchone()
    log_audit("worker.app_access_created", f"Mitarbeiter-App-Link fuer {worker_id} erzeugt", target_type="worker", target_id=worker_id, company_id=worker["company_id"], actor=g.current_user)
    return jsonify(payload)


@app.post("/api/worker-app/login")
@require_rate_limit("worker_login")
def worker_app_login():
    payload = request.get_json(silent=True) or {}
    access_token = (payload.get("accessToken") or "").strip()
    badge_id = (payload.get("badgeId") or "").strip().upper()
    badge_pin = normalize_badge_pin(payload.get("badgePin"))
    if not access_token and not badge_id:
        return jsonify({"error": "missing_worker_app_credentials"}), 400

    db = get_db()
    deleted = purge_expired_worker_app_sessions(db)
    if deleted > 0:
        db.commit()
    setting = db.execute("SELECT worker_app_enabled FROM settings WHERE id = 1").fetchone()
    if setting and int(setting["worker_app_enabled"]) == 0:
        return jsonify({"error": "worker_app_disabled", "message": "Die Mitarbeiter-App ist zurzeit nicht verfuegbar. Bitte spaeter erneut versuchen."}), 503

    if access_token:
        token_row = db.execute("SELECT * FROM worker_app_tokens WHERE token = ?", (access_token,)).fetchone()
        if not token_row:
            return jsonify({"error": "invalid_access_token"}), 401

        if token_row["revoked_at"]:
            return jsonify({"error": "access_token_already_used", "message": "Dieser Besucherkarten-Link wurde bereits genutzt."}), 401

        if token_row["expires_at"] < now_iso():
            return jsonify({"error": "access_token_expired"}), 401

        worker = db.execute("SELECT * FROM workers WHERE id = ?", (token_row["worker_id"],)).fetchone()
        if not worker or worker["deleted_at"]:
            return jsonify({"error": "worker_not_available"}), 401

        if worker_visit_has_expired(worker):
            return jsonify({"error": "visitor_visit_expired", "message": "Diese Besucherkarte ist zeitlich abgelaufen."}), 401

        company_error = get_company_access_error(db, worker["company_id"])
        if company_error:
            return jsonify(company_error), 403

        consumed_at = now_iso()
        consumed = db.execute(
            "UPDATE worker_app_tokens SET revoked_at = ? WHERE token = ? AND revoked_at IS NULL",
            (consumed_at, access_token),
        )
        if int(consumed.rowcount or 0) == 0:
            return jsonify({"error": "access_token_already_used", "message": "Dieser Besucherkarten-Link wurde bereits genutzt."}), 401

        session_data = create_worker_app_session(db, worker)
        log_audit(
            "worker_app.login",
            f"Besucher {worker['first_name']} {worker['last_name']} (Badge {worker['badge_id']}) hat sich per Einmal-Link angemeldet",
            target_type="worker", target_id=worker["id"], company_id=worker["company_id"]
        )
        db.commit()
        return jsonify(session_data)

    badge_matches = db.execute(
        """
        SELECT *
        FROM workers
        WHERE UPPER(badge_id) = ? AND deleted_at IS NULL
        ORDER BY id
        LIMIT 2
        """,
        (badge_id,),
    ).fetchall()
    if not badge_matches:
        return jsonify({"error": "invalid_badge_id", "message": "Badge-ID wurde nicht gefunden."}), 401
    if len(badge_matches) > 1:
        return jsonify({"error": "duplicate_badge_id", "message": "Badge-ID ist mehrfach vergeben. Bitte Admin informieren."}), 409

    worker = badge_matches[0]
    if worker_visit_has_expired(worker):
        return jsonify({"error": "visitor_visit_expired", "message": "Diese Besucherkarte ist zeitlich abgelaufen."}), 401

    is_visitor = badge_id.startswith("VS")
    if not is_visitor:
        if not worker["badge_pin_hash"]:
            return jsonify({"error": "badge_pin_not_configured", "message": "Fuer diese Karte ist noch keine Badge-PIN hinterlegt."}), 403
        if not badge_pin:
            return jsonify({"error": "missing_badge_pin", "message": "Bitte Badge-PIN eingeben."}), 400
        if not check_password_hash(worker["badge_pin_hash"], badge_pin):
            return jsonify({"error": "invalid_badge_pin", "message": "Badge-ID oder PIN ist ungueltig."}), 401

    company_error = get_company_access_error(db, worker["company_id"])
    if company_error:
        return jsonify(company_error), 403

    session_data = create_worker_app_session(db, worker)
    login_type = "Besucher" if is_visitor else "Mitarbeiter"
    log_audit(
        "worker_app.login",
        f"{login_type} {worker['first_name']} {worker['last_name']} (Badge {badge_id}) hat sich per Badge-ID angemeldet",
        target_type="worker", target_id=worker["id"], company_id=worker["company_id"]
    )
    db.commit()
    return jsonify(session_data)


@app.get("/api/worker-app/me")
@require_worker_session
def worker_app_me():
    db = get_db()
    worker = g.worker
    company = db.execute("SELECT * FROM companies WHERE id = ?", (worker["company_id"],)).fetchone()
    subcompany = None
    if worker["subcompany_id"]:
        subcompany = db.execute("SELECT * FROM subcompanies WHERE id = ?", (worker["subcompany_id"],)).fetchone()
    setting = db.execute("SELECT * FROM settings WHERE id = 1").fetchone()
    return jsonify(
        {
            "worker": serialize_worker_for_app(worker),
            "company": {
                "name": company["name"] if company else "",
            },
            "subcompany": {
                "name": subcompany["name"] if subcompany else "",
            },
            "settings": {
                "platformName": setting["platform_name"],
                "operatorName": setting["operator_name"],
            },
            "sessionExpiresAt": getattr(g, "worker_session_expires_at", ""),
            "cardType": normalize_worker_type(worker["worker_type"]),
        }
    )


@app.post("/api/worker-app/logout")
@require_worker_session
def worker_app_logout():
    db = get_db()
    db.execute("DELETE FROM worker_app_sessions WHERE token = ?", (g.worker_token,))
    db.commit()
    return jsonify({"ok": True})


@app.put("/api/companies/<company_id>")
@require_auth
@require_roles("superadmin")
def update_company(company_id):
    payload = request.get_json(silent=True) or {}
    db = get_db()
    company = db.execute("SELECT * FROM companies WHERE id = ?", (company_id,)).fetchone()
    if not company:
        return jsonify({"error": "company_not_found"}), 404

    db.execute(
        "UPDATE companies SET name = ?, contact = ?, billing_email = ?, access_host = ?, plan = ?, status = ? WHERE id = ?",
        (
            payload.get("name", company["name"]),
            payload.get("contact", company["contact"]),
            payload.get("billingEmail", company["billing_email"]),
            (payload.get("accessHost") or payload.get("access_host") or company["access_host"]),
            payload.get("plan", company["plan"]),
            payload.get("status", company["status"]),
            company_id,
        ),
    )
    db.commit()
    log_audit("company.updated", f"Firma {company_id} aktualisiert", target_type="company", target_id=company_id, company_id=company_id, actor=g.current_user)
    return jsonify({"ok": True})


@app.delete("/api/companies/<company_id>")
@require_auth
@require_roles("superadmin")
def delete_company(company_id):
    if company_id == "cmp-default":
        return jsonify({"error": "default_company_protected"}), 400

    db = get_db()
    force = request.args.get("force", "0") == "1"
    company = db.execute("SELECT * FROM companies WHERE id = ?", (company_id,)).fetchone()
    if not company:
        return jsonify({"error": "company_not_found"}), 404

    count = db.execute("SELECT COUNT(*) AS c FROM workers WHERE company_id = ? AND deleted_at IS NULL", (company_id,)).fetchone()["c"]
    if count > 0 and not force:
        return jsonify({"error": "company_has_workers"}), 400

    if force:
        now = now_iso()
        worker_rows = db.execute("SELECT id FROM workers WHERE company_id = ?", (company_id,)).fetchall()
        worker_ids = [row["id"] for row in worker_rows]

        db.execute("UPDATE workers SET deleted_at = ?, status = 'gesperrt' WHERE company_id = ?", (now, company_id))
        db.execute("UPDATE subcompanies SET deleted_at = ?, status = 'pausiert' WHERE company_id = ?", (now, company_id))
        db.execute("UPDATE companies SET deleted_at = ?, status = ? WHERE id = ?", (now, "pausiert", company_id))
        db.execute("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE company_id = ?)", (company_id,))

        if worker_ids:
            placeholders = ",".join(["?"] * len(worker_ids))
            db.execute(f"DELETE FROM worker_app_tokens WHERE worker_id IN ({placeholders})", worker_ids)
            db.execute(f"DELETE FROM worker_app_sessions WHERE worker_id IN ({placeholders})", worker_ids)
    else:
        db.execute("UPDATE companies SET deleted_at = ?, status = ? WHERE id = ?", (now_iso(), "pausiert", company_id))

    db.commit()
    log_audit(
        "company.deleted",
        f"Firma {company_id} gelöscht{' (force)' if force else ''}",
        target_type="company",
        target_id=company_id,
        company_id=company_id,
        actor=g.current_user,
    )
    return jsonify({"ok": True, "force": force})


@app.post("/api/companies/<company_id>/repair")
@require_auth
@require_roles("superadmin", "company-admin")
def repair_company(company_id):
    user = g.current_user
    db = get_db()
    if user["role"] != "superadmin" and user.get("company_id") != company_id:
        return jsonify({"error": "forbidden"}), 403

    now = now_iso()
    workers = db.execute("SELECT id FROM workers WHERE company_id = ?", (company_id,)).fetchall()
    worker_ids = [w["id"] for w in workers]
    fixed = []

    expired_tokens = 0
    expired_sessions = 0
    for wid in worker_ids:
        r = db.execute("DELETE FROM worker_app_tokens WHERE worker_id = ? AND expires_at < ?", (wid, now))
        expired_tokens += r.rowcount
        r = db.execute("DELETE FROM worker_app_sessions WHERE worker_id = ? AND expires_at < ?", (wid, now))
        expired_sessions += r.rowcount

    if expired_tokens:
        fixed.append(f"{expired_tokens} abgelaufene App-Tokens entfernt")
    if expired_sessions:
        fixed.append(f"{expired_sessions} abgelaufene App-Sitzungen entfernt")

    no_badge = db.execute(
        "SELECT id FROM workers WHERE company_id = ? AND (badge_id IS NULL OR badge_id = '') AND deleted_at IS NULL",
        (company_id,)
    ).fetchall()
    for w in no_badge:
        db.execute("UPDATE workers SET badge_id = ? WHERE id = ?", (f"BP-{w['id'][-6:].upper()}", w["id"]))
    if no_badge:
        fixed.append(f"{len(no_badge)} fehlende Ausweisnummern ergaenzt")

    bad_status = db.execute(
        "SELECT id FROM workers WHERE company_id = ? AND status NOT IN ('aktiv','gesperrt','abgelaufen') AND deleted_at IS NULL",
        (company_id,)
    ).fetchall()
    for w in bad_status:
        db.execute("UPDATE workers SET status = 'aktiv' WHERE id = ?", (w["id"],))
    if bad_status:
        fixed.append(f"{len(bad_status)} ungueltige Mitarbeiter-Status korrigiert")

    if not fixed:
        fixed.append("Keine Probleme gefunden - System ist in Ordnung")

    db.commit()
    log_audit("company.repair", f"Firma-Diagnose: {'; '.join(fixed)}", actor=user, target_type="company", target_id=company_id)
    return jsonify({"ok": True, "fixed": fixed})


@app.post("/api/companies/<company_id>/restore")
@require_auth
@require_roles("superadmin")
def restore_company(company_id):
    db = get_db()
    company = db.execute("SELECT * FROM companies WHERE id = ?", (company_id,)).fetchone()
    if not company:
        return jsonify({"error": "company_not_found"}), 404

    db.execute("UPDATE companies SET deleted_at = NULL, status = ? WHERE id = ?", ("aktiv", company_id))
    db.commit()
    log_audit("company.restored", f"Firma {company_id} wiederhergestellt", target_type="company", target_id=company_id, company_id=company_id, actor=g.current_user)
    return jsonify({"ok": True})


@app.get("/api/access-logs")
@require_auth
def list_access_logs():
    auto_close_open_entries_after_midnight(get_db())
    direction = (request.args.get("direction") or "").strip()
    gate = (request.args.get("gate") or "").strip()
    from_date = (request.args.get("from") or "").strip()
    to_date = (request.args.get("to") or "").strip()
    limit = min(max(int(request.args.get("limit", "1000")), 1), 5000)

    conditions, params = build_access_filters(g.current_user, direction, gate, from_date, to_date)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    rows = get_db().execute(
        f"""
        SELECT access_logs.*
        FROM access_logs
        JOIN workers ON workers.id = access_logs.worker_id
        {where_clause}
        ORDER BY timestamp DESC
        LIMIT ?
        """,
        [*params, limit],
    ).fetchall()

    return jsonify([row_to_dict(row) for row in rows])


@app.get("/api/access-logs/export.csv")
@require_auth
def export_access_csv():
    auto_close_open_entries_after_midnight(get_db())
    direction = (request.args.get("direction") or "").strip()
    gate = (request.args.get("gate") or "").strip()
    from_date = (request.args.get("from") or "").strip()
    to_date = (request.args.get("to") or "").strip()

    conditions, params = build_access_filters(g.current_user, direction, gate, from_date, to_date)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    rows = get_db().execute(
        f"""
        SELECT access_logs.id, access_logs.direction, access_logs.gate, access_logs.note, access_logs.timestamp,
               workers.first_name, workers.last_name, workers.badge_id
        FROM access_logs
        JOIN workers ON workers.id = access_logs.worker_id
        {where_clause}
        ORDER BY access_logs.timestamp DESC
        LIMIT 5000
        """,
        params,
    ).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "badge_id", "first_name", "last_name", "direction", "gate", "note", "timestamp_utc"])

    for row in rows:
        writer.writerow(
            [
                row["id"],
                row["badge_id"],
                row["first_name"],
                row["last_name"],
                row["direction"],
                row["gate"],
                row["note"],
                row["timestamp"],
            ]
        )

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=zutrittsjournal.csv"},
    )


@app.get("/api/access-logs/summary")
@require_auth
def access_summary():
    auto_close_expired_visitor_entries(get_db())
    auto_close_open_entries_after_midnight(get_db())
    direction = (request.args.get("direction") or "").strip()
    gate = (request.args.get("gate") or "").strip()
    from_date = (request.args.get("from") or "").strip()
    to_date = (request.args.get("to") or "").strip()

    conditions, params = build_access_filters(g.current_user, direction, gate, from_date, to_date)
    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    rows = get_db().execute(
        f"""
        SELECT access_logs.worker_id, access_logs.direction, access_logs.gate, access_logs.timestamp,
               workers.first_name, workers.last_name, workers.badge_id
        FROM access_logs
        JOIN workers ON workers.id = access_logs.worker_id
        {where_clause}
        ORDER BY access_logs.timestamp ASC
        LIMIT 5000
        """,
        params,
    ).fetchall()

    hourly = [{"hour": f"{hour:02d}:00", "checkIn": 0, "checkOut": 0} for hour in range(24)]
    now_dt = datetime.now(timezone.utc)

    for row in rows:
        ts = parse_iso_utc(row["timestamp"])
        if ts:
            hour = ts.hour
            if row["direction"] == "check-in":
                hourly[hour]["checkIn"] += 1
            elif row["direction"] == "check-out":
                hourly[hour]["checkOut"] += 1

    open_entries = build_open_entries_from_rows(rows, now_dt)

    return jsonify(
        {
            "hourly": hourly,
            "openEntries": open_entries[:150],
        }
    )


@app.get("/api/reporting/summary")
@require_auth
@require_roles("superadmin")
def reporting_summary():
    db = get_db()
    user = g.current_user
    is_superadmin = user["role"] == "superadmin"
    company_id = user.get("company_id")

    invoice_scope_sql = ""
    invoice_scope_params = []
    company_scope_sql = ""
    company_scope_params = []
    access_scope_sql = ""
    access_scope_params = []
    audit_scope_sql = ""
    audit_scope_params = []

    if not is_superadmin:
        invoice_scope_sql = " AND invoices.company_id = ?"
        invoice_scope_params = [company_id]
        company_scope_sql = " AND id = ?"
        company_scope_params = [company_id]
        access_scope_sql = " AND workers.company_id = ?"
        access_scope_params = [company_id]
        audit_scope_sql = " AND (company_id = ? OR company_id IS NULL)"
        audit_scope_params = [company_id]

    paid_total_row = db.execute(
        f"""
        SELECT COALESCE(SUM(invoices.total_amount), 0) AS value
        FROM invoices
        WHERE (invoices.status = 'bezahlt' OR invoices.paid_at IS NOT NULL)
        {invoice_scope_sql}
        """,
        invoice_scope_params,
    ).fetchone()

    open_total_row = db.execute(
        f"""
        SELECT COALESCE(SUM(invoices.total_amount), 0) AS value
        FROM invoices
        WHERE invoices.paid_at IS NULL
          AND invoices.status IN ('draft', 'sent', 'overdue', 'send_failed')
        {invoice_scope_sql}
        """,
        invoice_scope_params,
    ).fetchone()

    overdue_row = db.execute(
        f"""
        SELECT COUNT(*) AS invoice_count, COALESCE(SUM(invoices.total_amount), 0) AS total_value
        FROM invoices
        WHERE invoices.paid_at IS NULL
          AND invoices.due_date IS NOT NULL
          AND DATE(invoices.due_date) < DATE('now')
        {invoice_scope_sql}
        """,
        invoice_scope_params,
    ).fetchone()

    locked_companies_row = db.execute(
        f"""
        SELECT COUNT(*) AS value
        FROM companies
        WHERE deleted_at IS NULL
          AND status = 'gesperrt'
        {company_scope_sql}
        """,
        company_scope_params,
    ).fetchone()

    suspensions_row = db.execute(
        f"""
        SELECT COUNT(*) AS value
        FROM audit_logs
        WHERE event_type = 'company.auto_suspended_overdue_invoice'
          AND DATE(created_at) >= DATE('now', '-30 day')
        {audit_scope_sql}
        """,
        audit_scope_params,
    ).fetchone()

    access_rows = db.execute(
        f"""
        SELECT DATE(access_logs.timestamp) AS day,
               SUM(CASE WHEN access_logs.direction = 'check-in' THEN 1 ELSE 0 END) AS check_in,
               SUM(CASE WHEN access_logs.direction = 'check-out' THEN 1 ELSE 0 END) AS check_out
        FROM access_logs
        JOIN workers ON workers.id = access_logs.worker_id
        WHERE DATE(access_logs.timestamp) >= DATE('now', '-6 day')
        {access_scope_sql}
        GROUP BY DATE(access_logs.timestamp)
        ORDER BY day ASC
        """,
        access_scope_params,
    ).fetchall()

    access_map = {row["day"]: row for row in access_rows}
    access_daily = []
    for day_offset in range(6, -1, -1):
        day = (datetime.now(timezone.utc).date() - timedelta(days=day_offset)).isoformat()
        source = access_map.get(day)
        access_daily.append(
            {
                "day": day,
                "checkIn": int(source["check_in"] or 0) if source else 0,
                "checkOut": int(source["check_out"] or 0) if source else 0,
            }
        )

    top_overdue_companies = []
    if is_superadmin:
        top_rows = db.execute(
            """
            SELECT companies.id, companies.name,
                   COUNT(invoices.id) AS overdue_count,
                   COALESCE(SUM(invoices.total_amount), 0) AS overdue_total
            FROM invoices
            JOIN companies ON companies.id = invoices.company_id
            WHERE invoices.paid_at IS NULL
              AND invoices.due_date IS NOT NULL
              AND DATE(invoices.due_date) < DATE('now')
              AND companies.deleted_at IS NULL
            GROUP BY companies.id, companies.name
            ORDER BY overdue_total DESC
            LIMIT 5
            """
        ).fetchall()
        top_overdue_companies = [
            {
                "companyId": row["id"],
                "companyName": row["name"],
                "overdueCount": int(row["overdue_count"] or 0),
                "overdueTotal": float(row["overdue_total"] or 0),
            }
            for row in top_rows
        ]

    return jsonify(
        {
            "kpis": {
                "paidTotal": float(paid_total_row["value"] or 0),
                "openTotal": float(open_total_row["value"] or 0),
                "overdueInvoiceCount": int(overdue_row["invoice_count"] or 0),
                "overdueTotal": float(overdue_row["total_value"] or 0),
                "lockedCompanies": int(locked_companies_row["value"] or 0),
                "suspensionsLast30d": int(suspensions_row["value"] or 0),
            },
            "accessDaily": access_daily,
            "topOverdueCompanies": top_overdue_companies,
            "generatedAt": now_iso(),
        }
    )


@app.get("/api/access-logs/day-close-check")
@require_auth
def access_day_close_check():
    auto_close_expired_visitor_entries(get_db())
    auto_closed = auto_close_open_entries_after_midnight(get_db())
    date_value = (request.args.get("date") or "").strip()
    if not date_value:
        date_value = datetime.now().date().isoformat()

    conditions, params = build_access_filters(g.current_user, "", "", date_value, date_value)
    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    rows = get_db().execute(
        f"""
        SELECT access_logs.worker_id, access_logs.direction, access_logs.gate, access_logs.timestamp,
               workers.first_name, workers.last_name, workers.badge_id
        FROM access_logs
        JOIN workers ON workers.id = access_logs.worker_id
        {where_clause}
        ORDER BY access_logs.timestamp ASC
        LIMIT 5000
        """,
        params,
    ).fetchall()

    now_dt = datetime.now(timezone.utc)
    open_entries = build_open_entries_from_rows(rows, now_dt)

    db = get_db()
    ack_scope_condition = "company_id IS NULL"
    ack_params = [date_value]
    if g.current_user["role"] != "superadmin":
        ack_scope_condition = "company_id = ?"
        ack_params.append(g.current_user.get("company_id"))

    try:
        acknowledgement = db.execute(
            f"""
            SELECT day_close_acknowledgements.*, users.name AS acknowledged_by_name
            FROM day_close_acknowledgements
            JOIN users ON users.id = day_close_acknowledgements.acknowledged_by_user_id
            WHERE day_close_acknowledgements.date = ? AND {ack_scope_condition}
            ORDER BY day_close_acknowledgements.created_at DESC
            LIMIT 1
            """,
            ack_params,
        ).fetchone()
    except sqlite3.OperationalError:
        acknowledgement = None

    acknowledgement_payload = None
    if acknowledgement:
        acknowledgement_payload = {
            "id": acknowledgement["id"],
            "date": acknowledgement["date"],
            "comment": acknowledgement["comment"],
            "openCount": acknowledgement["open_count"],
            "createdAt": acknowledgement["created_at"],
            "acknowledgedBy": acknowledgement["acknowledged_by_name"],
        }

    return jsonify(
        {
            "date": date_value,
            "due": datetime.now().hour >= 18,
            "openCount": len(open_entries),
            "openEntries": open_entries[:150],
            "autoClosedCount": len(auto_closed),
            "autoClosedEntries": auto_closed[:50],
            "acknowledgement": acknowledgement_payload,
        }
    )


@app.post("/api/access-logs/day-close-ack")
@require_auth
@require_roles("superadmin", "company-admin")
def acknowledge_day_close():
    payload = request.get_json(silent=True) or {}
    date_value = (payload.get("date") or "").strip() or datetime.now().date().isoformat()
    comment = (payload.get("comment") or "").strip()

    if len(comment) < 4:
        return jsonify({"error": "comment_too_short"}), 400

    conditions, params = build_access_filters(g.current_user, "", "", date_value, date_value)
    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    rows = get_db().execute(
        f"""
        SELECT access_logs.worker_id, access_logs.direction, access_logs.gate, access_logs.timestamp,
               workers.first_name, workers.last_name, workers.badge_id
        FROM access_logs
        JOIN workers ON workers.id = access_logs.worker_id
        {where_clause}
        ORDER BY access_logs.timestamp ASC
        LIMIT 5000
        """,
        params,
    ).fetchall()

    open_entries = build_open_entries_from_rows(rows, datetime.now(timezone.utc))
    company_id = None if g.current_user["role"] == "superadmin" else g.current_user.get("company_id")
    ack_id = f"ack-{secrets.token_hex(6)}"

    db = get_db()
    db.execute(
        """
        INSERT INTO day_close_acknowledgements (id, date, company_id, acknowledged_by_user_id, comment, open_count, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            ack_id,
            date_value,
            company_id,
            g.current_user["id"],
            comment,
            len(open_entries),
            now_iso(),
        ),
    )
    db.commit()

    log_audit(
        "access.day_close_acknowledged",
        f"Tagesabschluss für {date_value} quittiert: {comment}",
        target_type="access",
        target_id=date_value,
        company_id=company_id,
        actor=g.current_user,
    )

    return jsonify({"ok": True, "id": ack_id, "openCount": len(open_entries), "date": date_value})


@app.post("/api/access-logs")
@require_auth
def create_access_log():
    auto_close_expired_visitor_entries(get_db())
    auto_close_open_entries_after_midnight(get_db())
    payload = request.get_json(silent=True) or {}
    worker_id = payload.get("workerId")
    user = g.current_user

    db = get_db()
    worker = db.execute("SELECT * FROM workers WHERE id = ?", (worker_id,)).fetchone()
    if not worker:
        return jsonify({"error": "worker_not_found"}), 404

    if worker["deleted_at"]:
        return jsonify({"error": "worker_deleted"}), 400

    if user["role"] != "superadmin" and worker["company_id"] != user.get("company_id"):
        return jsonify({"error": "forbidden_worker"}), 403

    company_error = get_company_access_error(db, worker["company_id"])
    if company_error:
        return jsonify(company_error), 403

    if worker_visit_has_expired(worker):
        return jsonify({"error": "visitor_visit_expired", "message": "Diese Besucherkarte ist zeitlich abgelaufen."}), 400

    if worker["status"] != "aktiv":
        return jsonify({"error": "worker_not_active"}), 400

    log_id = create_access_log_entry(
        db,
        worker_id,
        payload.get("direction", "check-in"),
        payload.get("gate", "Drehkreuz Nord"),
        payload.get("note", ""),
        payload.get("timestamp", now_iso()),
    )
    db.commit()
    log_audit("access.booked", f"Zutritt {payload.get('direction', 'check-in')} fuer Worker {worker_id}", target_type="worker", target_id=worker_id, company_id=worker["company_id"], actor=g.current_user)
    row = db.execute("SELECT * FROM access_logs WHERE id = ?", (log_id,)).fetchone()
    return jsonify(row_to_dict(row)), 201


@app.post("/api/gates/tap")
def gate_tap():
    auto_close_expired_visitor_entries(get_db())
    auto_close_open_entries_after_midnight(get_db())
    expected_key = (os.getenv("BAUPASS_GATE_API_KEY") or "").strip()
    if not expected_key:
        return jsonify({"error": "gate_key_not_configured"}), 503

    provided_key = (request.headers.get("X-Gate-Key") or "").strip()
    if not provided_key or not secrets.compare_digest(provided_key, expected_key):
        return jsonify({"error": "gate_unauthorized"}), 401

    payload = request.get_json(silent=True) or {}
    physical_card_id = normalize_physical_card_id(payload.get("physicalCardId") or payload.get("cardId"))
    if not physical_card_id:
        return jsonify({"error": "missing_physical_card_id"}), 400

    direction = (payload.get("direction") or "check-in").strip().lower()
    if direction not in {"check-in", "check-out"}:
        return jsonify({"error": "invalid_direction"}), 400

    gate_name = (payload.get("gate") or "NFC Gate").strip() or "NFC Gate"
    gate_note = (payload.get("note") or "NFC Tap").strip()
    timestamp_value = (payload.get("timestamp") or now_iso()).strip() or now_iso()

    db = get_db()
    workers = db.execute(
        """
        SELECT *
        FROM workers
        WHERE physical_card_id = ? AND deleted_at IS NULL
        ORDER BY id
        LIMIT 2
        """,
        (physical_card_id,),
    ).fetchall()
    if not workers:
        return jsonify({"error": "card_not_assigned"}), 404
    if len(workers) > 1:
        return jsonify({"error": "duplicate_physical_card_id"}), 409

    worker = workers[0]
    company_error = get_company_access_error(db, worker["company_id"])
    if company_error:
        return jsonify(company_error), 403
    if worker_visit_has_expired(worker):
        return jsonify({"error": "visitor_visit_expired", "message": "Diese Besucherkarte ist zeitlich abgelaufen."}), 403
    if worker["status"] != "aktiv":
        return jsonify({"error": "worker_not_active"}), 403

    log_id = create_access_log_entry(db, worker["id"], direction, gate_name, gate_note, timestamp_value)
    db.commit()
    log_audit(
        "access.gate_tap",
        f"NFC Tap {direction} fuer Worker {worker['id']} an {gate_name}",
        target_type="worker",
        target_id=worker["id"],
        company_id=worker["company_id"],
        actor=None,
    )

    return jsonify(
        {
            "ok": True,
            "logId": log_id,
            "worker": {
                "id": worker["id"],
                "firstName": worker["first_name"],
                "lastName": worker["last_name"],
                "badgeId": worker["badge_id"],
                "status": worker["status"],
            },
            "direction": direction,
            "gate": gate_name,
            "timestamp": timestamp_value,
        }
    ), 201


def send_invoice_email(invoice_row, company_row, settings_row):
    smtp_host = (settings_row["smtp_host"] or "").strip()
    smtp_sender = (settings_row["smtp_sender_email"] or "").strip()
    if not smtp_host or not smtp_sender:
        return False, "SMTP ist nicht konfiguriert"

    message = EmailMessage()
    message["Subject"] = f"Rechnung {invoice_row['invoice_number']} - {settings_row['operator_name']}"
    message["From"] = f"{settings_row['smtp_sender_name']} <{smtp_sender}>"
    message["To"] = invoice_row["recipient_email"]
    message.set_content(
        (
            f"Guten Tag,\n\n"
            f"anbei erhalten Sie die Rechnung {invoice_row['invoice_number']} für {company_row['name']}.\n"
            f"Faellig am: {(invoice_row['due_date'] or '-')}\n"
            f"Gesamtbetrag: {invoice_row['total_amount']:.2f} EUR\n\n"
            f"Viele Grüße\n{settings_row['operator_name']}"
        )
    )
    message.add_alternative(invoice_row["rendered_html"], subtype="html")

    try:
        with smtplib.SMTP(smtp_host, int(settings_row["smtp_port"] or 587), timeout=20) as smtp:
            if int(settings_row["smtp_use_tls"] or 0) == 1:
                smtp.starttls()
            smtp_username = (settings_row["smtp_username"] or "").strip()
            if smtp_username:
                smtp.login(smtp_username, settings_row["smtp_password"] or "")
            smtp.send_message(message)
        return True, ""
    except Exception as exc:
        return False, str(exc)


@app.get("/api/invoices")
@require_auth
@require_roles("superadmin")
def list_invoices():
    db = get_db()
    if g.current_user["role"] == "superadmin":
        rows = db.execute(
            """
            SELECT invoices.*, companies.name AS company_name
            FROM invoices
            JOIN companies ON companies.id = invoices.company_id
            ORDER BY invoices.created_at DESC
            LIMIT 300
            """
        ).fetchall()
    else:
        rows = db.execute(
            """
            SELECT invoices.*, companies.name AS company_name
            FROM invoices
            JOIN companies ON companies.id = invoices.company_id
            WHERE invoices.company_id = ?
            ORDER BY invoices.created_at DESC
            LIMIT 300
            """,
            (g.current_user["company_id"],),
        ).fetchall()
    return jsonify([row_to_dict(row) for row in rows])


@app.post("/api/invoices/send")
@require_auth
@require_roles("superadmin")
def send_invoice():
    payload = request.get_json(silent=True) or {}
    company_id = payload.get("companyId")
    recipient_email = (payload.get("recipientEmail") or "").strip()
    if "@" not in recipient_email:
        return jsonify({"error": "invalid_recipient_email"}), 400

    db = get_db()
    company = db.execute("SELECT * FROM companies WHERE id = ?", (company_id,)).fetchone()
    if not company or company["deleted_at"]:
        return jsonify({"error": "company_not_available"}), 400

    if g.current_user["role"] != "superadmin" and company_id != g.current_user.get("company_id"):
        return jsonify({"error": "forbidden_company"}), 403

    invoice_number = (payload.get("invoiceNumber") or "").strip() or f"RE-{datetime.now().year}-{secrets.token_hex(3).upper()}"
    duplicate_invoice = db.execute(
        "SELECT id FROM invoices WHERE company_id = ? AND invoice_number = ? LIMIT 1",
        (company_id, invoice_number),
    ).fetchone()
    if duplicate_invoice:
        return jsonify({"error": "duplicate_invoice_number", "message": "Rechnungsnummer ist bereits vergeben."}), 409

    invoice_date = (payload.get("invoiceDate") or datetime.now().date().isoformat()).strip()
    due_date_input = (payload.get("dueDate") or "").strip()
    invoice_date_obj = parse_iso_date(invoice_date) or datetime.utcnow().date()
    due_date_obj = parse_iso_date(due_date_input) or (invoice_date_obj + timedelta(days=14))
    due_date = due_date_obj.isoformat()
    invoice_period = (payload.get("invoicePeriod") or "").strip()
    description = (payload.get("description") or "").strip()
    rendered_html = payload.get("renderedHtml") or ""
    net_amount = calculate_net_amount_by_plan(company["plan"], payload.get("netAmount"))
    vat_rate = float(payload.get("vatRate") or 0)
    vat_amount = round(net_amount * (vat_rate / 100), 2)
    total_amount = round(net_amount + vat_amount, 2)

    if not invoice_period or not description or not rendered_html:
        return jsonify({"error": "missing_invoice_fields"}), 400

    invoice_id = f"inv-{secrets.token_hex(6)}"
    db.execute(
        """
        INSERT INTO invoices (
            id, invoice_number, company_id, recipient_email, invoice_date, invoice_period, description,
            net_amount, vat_rate, vat_amount, total_amount, status, error_message, sent_at,
            rendered_html, created_by_user_id, created_at, due_date, reminder_stage, last_reminder_sent_at, last_reminder_error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            invoice_id,
            invoice_number,
            company_id,
            recipient_email,
            invoice_date,
            invoice_period,
            description,
            net_amount,
            vat_rate,
            vat_amount,
            total_amount,
            "draft",
            "",
            None,
            rendered_html,
            g.current_user["id"],
            now_iso(),
            due_date,
            0,
            None,
            "",
        ),
    )

    settings = db.execute("SELECT * FROM settings WHERE id = 1").fetchone()
    invoice_row = db.execute("SELECT * FROM invoices WHERE id = ?", (invoice_id,)).fetchone()
    sent_ok, error_message = send_invoice_email(invoice_row, company, settings)

    if sent_ok:
        db.execute("UPDATE invoices SET status = ?, sent_at = ?, error_message = '' WHERE id = ?", ("sent", now_iso(), invoice_id))
        log_audit("invoice.sent", f"Rechnung {invoice_number} an {recipient_email} versendet", target_type="invoice", target_id=invoice_id, company_id=company_id, actor=g.current_user)
    else:
        db.execute("UPDATE invoices SET status = ?, error_message = ? WHERE id = ?", ("send_failed", error_message, invoice_id))
        log_audit("invoice.send_failed", f"Rechnung {invoice_number} konnte nicht versendet werden: {error_message}", target_type="invoice", target_id=invoice_id, company_id=company_id, actor=g.current_user)
    db.commit()

    result = db.execute("SELECT * FROM invoices WHERE id = ?", (invoice_id,)).fetchone()
    return jsonify({"invoice": row_to_dict(result), "sent": sent_ok, "error": error_message if not sent_ok else ""})


@app.put("/api/invoices/<invoice_id>/pay")
@require_auth
@require_roles("superadmin")
def mark_invoice_paid(invoice_id):
    """Mark an invoice as paid, optionally lifting company suspension if all invoices are now paid."""
    payload = request.get_json(silent=True) or {}
    payment_date = (payload.get("paymentDate") or now_iso().split("T")[0]).strip()
    notes = (payload.get("notes") or "").strip()

    db = get_db()
    invoice = db.execute("SELECT * FROM invoices WHERE id = ?", (invoice_id,)).fetchone()
    if not invoice:
        return jsonify({"error": "invoice_not_found"}), 404

    # Permission check: verify company_id matches current user
    if g.current_user["role"] != "superadmin" and invoice["company_id"] != g.current_user.get("company_id"):
        return jsonify({"error": "forbidden_company"}), 403

    invoice_number = invoice["invoice_number"]
    company_id = invoice["company_id"]
    company = db.execute("SELECT * FROM companies WHERE id = ?", (company_id,)).fetchone()
    if not company:
        return jsonify({"error": "company_not_found"}), 404

    # Mark as paid
    db.execute(
        "UPDATE invoices SET status = ?, paid_at = ?, last_reminder_error = '' WHERE id = ?",
        ("bezahlt", payment_date, invoice_id),
    )
    log_audit(
        "invoice.marked_paid",
        f"Rechnung {invoice_number} als bezahlt markiert",
        target_type="invoice",
        target_id=invoice_id,
        company_id=company_id,
        actor=g.current_user,
    )

    # Check if company should be unsuspended: all invoices are now either paid or cancelled
    remaining_overdue = db.execute(
        """
        SELECT COUNT(*) as count FROM invoices
        WHERE company_id = ? AND paid_at IS NULL AND auto_suspend_triggered_at IS NOT NULL
        """,
        (company_id,),
    ).fetchone()

    if remaining_overdue["count"] == 0 and company["status"] == "gesperrt":
        # Lift suspension if all auto-suspended invoices are now paid
        db.execute("UPDATE companies SET status = ? WHERE id = ?", ("aktiv", company_id))
        log_audit(
            "company.auto_unsuspended_invoices_paid",
            f"Firma '{company['name']}' Sperrung aufgehoben - alle Rechnungen bezahlt",
            target_type="company",
            target_id=company_id,
            actor=g.current_user,
        )

    db.commit()
    result = db.execute("SELECT * FROM invoices WHERE id = ?", (invoice_id,)).fetchone()
    return jsonify({"invoice": row_to_dict(result)})


@app.get("/api/audit-logs")
@require_auth
@require_roles("superadmin", "company-admin")
def list_audit_logs():
    user = g.current_user
    db = get_db()
    event_type = (request.args.get("eventType") or "").strip()
    actor_role = (request.args.get("actorRole") or "").strip()
    target_type = (request.args.get("targetType") or "").strip()
    query_text = (request.args.get("q") or "").strip()
    from_date = (request.args.get("from") or "").strip()
    to_date = (request.args.get("to") or "").strip()
    limit = min(max(int(request.args.get("limit", "300")), 1), 1000)

    conditions = []
    params = []

    if user["role"] != "superadmin":
        conditions.append("(company_id = ? OR company_id IS NULL)")
        params.append(user["company_id"])

    if event_type:
        conditions.append("event_type = ?")
        params.append(event_type)

    if actor_role:
        conditions.append("actor_role = ?")
        params.append(actor_role)

    if target_type:
        conditions.append("target_type = ?")
        params.append(target_type)

    if query_text:
        conditions.append("(message LIKE ? OR event_type LIKE ? OR IFNULL(target_id, '') LIKE ?)")
        pattern = f"%{query_text}%"
        params.extend([pattern, pattern, pattern])

    if from_date:
        conditions.append("created_at >= ?")
        params.append(f"{from_date}T00:00:00Z")

    if to_date:
        conditions.append("created_at <= ?")
        params.append(f"{to_date}T23:59:59Z")

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    rows = db.execute(f"SELECT * FROM audit_logs {where_clause} ORDER BY created_at DESC LIMIT ?", [*params, limit]).fetchall()

    return jsonify([row_to_dict(row) for row in rows])


@app.get("/api/audit-logs/export.csv")
@require_auth
@require_roles("superadmin", "company-admin")
def export_audit_csv():
    user = g.current_user
    db = get_db()
    event_type = (request.args.get("eventType") or "").strip()
    actor_role = (request.args.get("actorRole") or "").strip()
    target_type = (request.args.get("targetType") or "").strip()
    query_text = (request.args.get("q") or "").strip()
    from_date = (request.args.get("from") or "").strip()
    to_date = (request.args.get("to") or "").strip()

    conditions = []
    params = []
    if user["role"] != "superadmin":
        conditions.append("(company_id = ? OR company_id IS NULL)")
        params.append(user["company_id"])
    if event_type:
        conditions.append("event_type = ?")
        params.append(event_type)
    if actor_role:
        conditions.append("actor_role = ?")
        params.append(actor_role)
    if target_type:
        conditions.append("target_type = ?")
        params.append(target_type)
    if query_text:
        conditions.append("(message LIKE ? OR event_type LIKE ? OR IFNULL(target_id, '') LIKE ?)")
        pattern = f"%{query_text}%"
        params.extend([pattern, pattern, pattern])
    if from_date:
        conditions.append("created_at >= ?")
        params.append(f"{from_date}T00:00:00Z")
    if to_date:
        conditions.append("created_at <= ?")
        params.append(f"{to_date}T23:59:59Z")

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    rows = db.execute(f"SELECT * FROM audit_logs {where_clause} ORDER BY created_at DESC LIMIT 2000", params).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "event_type", "actor_user_id", "actor_role", "company_id", "target_type", "target_id", "message", "created_at"])
    for row in rows:
        writer.writerow(
            [
                row["id"],
                row["event_type"],
                row["actor_user_id"],
                row["actor_role"],
                row["company_id"],
                row["target_type"],
                row["target_id"],
                row["message"],
                row["created_at"],
            ]
        )

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit-logs.csv"},
    )


@app.get("/api/export")
@require_auth
def export_payload():
    db = get_db()
    user = g.current_user
    include_audit = request.args.get("includeAudit", "0") == "1"
    include_day_close = request.args.get("includeDayClose", "0") == "1"
    include_deleted = request.args.get("includeDeleted", "0") == "1"
    requested_company_id = (request.args.get("companyId") or "").strip()

    if user["role"] != "superadmin":
        requested_company_id = user.get("company_id") or ""

    settings = get_settings().json
    companies = list_companies().json
    subcompanies = list_subcompanies().json
    workers = list_workers().json
    logs = list_access_logs().json
    invoices = []
    if user["role"] == "superadmin":
        if requested_company_id:
            invoice_rows = db.execute(
                """
                SELECT invoices.*, companies.name AS company_name
                FROM invoices
                JOIN companies ON companies.id = invoices.company_id
                WHERE invoices.company_id = ?
                ORDER BY invoices.created_at DESC
                """,
                (requested_company_id,),
            ).fetchall()
            invoices = [row_to_dict(row) for row in invoice_rows]
        else:
            invoice_rows = db.execute(
                """
                SELECT invoices.*, companies.name AS company_name
                FROM invoices
                JOIN companies ON companies.id = invoices.company_id
                ORDER BY invoices.created_at DESC
                """
            ).fetchall()
            invoices = [row_to_dict(row) for row in invoice_rows]

    if include_deleted:
        if requested_company_id:
            worker_rows = db.execute(
                "SELECT * FROM workers WHERE company_id = ? ORDER BY last_name, first_name",
                (requested_company_id,),
            ).fetchall()
        elif user["role"] == "superadmin":
            worker_rows = db.execute("SELECT * FROM workers ORDER BY last_name, first_name").fetchall()
        else:
            worker_rows = db.execute(
                "SELECT * FROM workers WHERE company_id = ? ORDER BY last_name, first_name",
                (user.get("company_id"),),
            ).fetchall()
        workers = [serialize_worker_record(row) for row in worker_rows]

    if requested_company_id:
        companies = [item for item in companies if item.get("id") == requested_company_id]
        subcompanies = [item for item in subcompanies if item.get("companyId") == requested_company_id]
        workers = [item for item in workers if item.get("companyId") == requested_company_id]
        worker_ids = {item.get("id") for item in workers}
        logs = [item for item in logs if item.get("workerId") in worker_ids]
    elif not include_deleted:
        companies = [item for item in companies if not item.get("deleted_at")]
        workers = [item for item in workers if not item.get("deletedAt")]

    user = g.current_user
    users = [user]

    if user["role"] == "superadmin":
        rows = db.execute("SELECT * FROM users ORDER BY username").fetchall()
        users = [row_to_dict(row) for row in rows]
        if requested_company_id:
            users = [item for item in users if item.get("company_id") in [None, requested_company_id]]
    users = [
        {
            "id": item["id"],
            "username": item["username"],
            "name": item["name"],
            "role": item["role"],
            "company_id": item["company_id"],
            "twofa_enabled": int(item.get("twofa_enabled", 0)),
        }
        for item in users
    ]

    audit_logs = []
    if include_audit:
        if user["role"] == "superadmin" and not requested_company_id:
            audit_rows = db.execute("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5000").fetchall()
        else:
            scope_company_id = requested_company_id or user.get("company_id")
            audit_rows = db.execute(
                "SELECT * FROM audit_logs WHERE company_id = ? OR company_id IS NULL ORDER BY created_at DESC LIMIT 5000",
                (scope_company_id,),
            ).fetchall()
        audit_logs = [row_to_dict(row) for row in audit_rows]

    day_close_acknowledgements = []
    if include_day_close:
        if user["role"] == "superadmin" and not requested_company_id:
            ack_rows = db.execute("SELECT * FROM day_close_acknowledgements ORDER BY created_at DESC LIMIT 2000").fetchall()
        else:
            scope_company_id = requested_company_id or user.get("company_id")
            ack_rows = db.execute(
                "SELECT * FROM day_close_acknowledgements WHERE company_id = ? OR company_id IS NULL ORDER BY created_at DESC LIMIT 2000",
                (scope_company_id,),
            ).fetchall()
        day_close_acknowledgements = [row_to_dict(row) for row in ack_rows]

    export_scope = "company" if requested_company_id else ("system" if user["role"] == "superadmin" else "company")
    metadata = {
        "schemaVersion": "2026-04-export-v2",
        "scope": export_scope,
        "companyId": requested_company_id or user.get("company_id"),
        "generatedBy": {
            "id": user.get("id"),
            "username": user.get("username"),
            "role": user.get("role"),
        },
        "counts": {
            "companies": len(companies),
            "subcompanies": len(subcompanies),
            "workers": len(workers),
            "accessLogs": len(logs),
            "invoices": len(invoices),
            "users": len(users),
            "auditLogs": len(audit_logs),
            "dayCloseAcknowledgements": len(day_close_acknowledgements),
        },
        "options": {
            "includeAudit": include_audit,
            "includeDayClose": include_day_close,
            "includeDeleted": include_deleted,
        },
    }

    log_audit(
        "export.created",
        f"Export erstellt (scope={export_scope}, companies={len(companies)}, workers={len(workers)}, logs={len(logs)})",
        target_type="export",
        target_id=metadata["schemaVersion"],
        company_id=metadata["companyId"],
        actor=user,
    )

    return jsonify(
        {
            "meta": metadata,
            "settings": settings,
            "companies": companies,
            "subcompanies": subcompanies,
            "workers": workers,
            "accessLogs": logs,
            "invoices": invoices,
            "users": users,
            "auditLogs": audit_logs,
            "dayCloseAcknowledgements": day_close_acknowledgements,
            "exportedAt": now_iso(),
        }
    )


@app.post("/api/import")
@require_auth
@require_roles("superadmin", "company-admin")
@require_rate_limit("import")
def import_payload():
    payload = request.get_json(silent=True) or {}
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    dry_run = int(payload.get("dryRun", 1)) == 1
    import_only_changes = int(payload.get("importOnlyChanges", 0)) == 1

    if not isinstance(data, dict):
        return jsonify({"error": "invalid_payload"}), 400

    db = get_db()
    user = g.current_user
    role = user.get("role")
    target_company_id = user.get("company_id") if role != "superadmin" else (payload.get("companyId") or "")
    meta = data.get("meta") if isinstance(data.get("meta"), dict) else {}
    schema_version = str(meta.get("schemaVersion") or "").strip()
    if schema_version and not schema_version.startswith("2026-04-export-v2"):
        return jsonify({"error": "unsupported_schema_version", "message": f"Import-Version nicht unterstützt: {schema_version}"}), 400

    companies = data.get("companies") or []
    subcompanies = data.get("subcompanies") or []
    workers = data.get("workers") or []
    access_logs = data.get("accessLogs") or []
    invoices = data.get("invoices") or []

    summary = {
        "dryRun": dry_run,
        "schemaVersion": schema_version or "unknown",
        "importOnlyChanges": import_only_changes,
        "accepted": {"companies": 0, "subcompanies": 0, "workers": 0, "accessLogs": 0, "invoices": 0},
        "unchanged": {"companies": 0, "subcompanies": 0, "workers": 0, "accessLogs": 0, "invoices": 0},
        "skipped": {"forbidden": 0, "invalid": 0},
        "conflicts": {"companies": 0, "subcompanies": 0, "workers": 0, "accessLogs": 0, "invoices": 0},
    }

    def company_allowed(company_id):
        if role == "superadmin":
            return True if not target_company_id else str(company_id or "") == str(target_company_id)
        return str(company_id or "") == str(target_company_id or "")

    prepared_companies = []
    prepared_subcompanies = []
    prepared_workers = []
    prepared_access_logs = []
    prepared_invoices = []

    for item in companies:
        cid = item.get("id")
        if not cid:
            summary["skipped"]["invalid"] += 1
            continue
        if not company_allowed(cid):
            summary["skipped"]["forbidden"] += 1
            continue
        exists = db.execute("SELECT 1 FROM companies WHERE id = ?", (cid,)).fetchone()
        if exists:
            summary["conflicts"]["companies"] += 1
            if import_only_changes:
                current = db.execute(
                    "SELECT * FROM companies WHERE id = ?",
                    (cid,),
                ).fetchone()
                if current and current["name"] == item.get("name", "") and current["contact"] == item.get("contact", "") and current["billing_email"] == item.get("billing_email", item.get("billingEmail", "")) and current["access_host"] == item.get("access_host", item.get("accessHost", "")) and normalize_company_plan(current["plan"]) == normalize_company_plan(item.get("plan")) and current["status"] == item.get("status", "aktiv"):
                    summary["unchanged"]["companies"] += 1
                    continue
        prepared_companies.append(
            (
                cid,
                item.get("name", ""),
                item.get("contact", ""),
                item.get("billing_email", item.get("billingEmail", "")),
                item.get("access_host", item.get("accessHost", "")),
                normalize_company_plan(item.get("plan")),
                item.get("status", "aktiv"),
                item.get("deleted_at", item.get("deletedAt")),
            )
        )

    for item in subcompanies:
        sid = item.get("id")
        cid = item.get("company_id", item.get("companyId"))
        if not sid or not cid:
            summary["skipped"]["invalid"] += 1
            continue
        if not company_allowed(cid):
            summary["skipped"]["forbidden"] += 1
            continue
        exists = db.execute("SELECT 1 FROM subcompanies WHERE id = ?", (sid,)).fetchone()
        if exists:
            summary["conflicts"]["subcompanies"] += 1
            if import_only_changes:
                current = db.execute("SELECT * FROM subcompanies WHERE id = ?", (sid,)).fetchone()
                if current and current["company_id"] == cid and current["name"] == item.get("name", "") and current["contact"] == item.get("contact", "") and current["status"] == item.get("status", "aktiv"):
                    summary["unchanged"]["subcompanies"] += 1
                    continue
        prepared_subcompanies.append(
            (
                sid,
                cid,
                item.get("name", ""),
                item.get("contact", ""),
                item.get("status", "aktiv"),
                item.get("deleted_at", item.get("deletedAt")),
            )
        )

    for item in workers:
        wid = item.get("id")
        cid = item.get("company_id", item.get("companyId"))
        if not wid or not cid:
            summary["skipped"]["invalid"] += 1
            continue
        if not company_allowed(cid):
            summary["skipped"]["forbidden"] += 1
            continue
        exists = db.execute("SELECT 1 FROM workers WHERE id = ?", (wid,)).fetchone()
        if exists:
            summary["conflicts"]["workers"] += 1
            if import_only_changes:
                current = db.execute("SELECT * FROM workers WHERE id = ?", (wid,)).fetchone()
                if current and current["company_id"] == cid and (current["subcompany_id"] or "") == (item.get("subcompany_id", item.get("subcompanyId")) or "") and current["first_name"] == item.get("first_name", item.get("firstName", "")) and current["last_name"] == item.get("last_name", item.get("lastName", "")) and current["insurance_number"] == item.get("insurance_number", item.get("insuranceNumber", "")) and normalize_worker_type(current["worker_type"]) == normalize_worker_type(item.get("worker_type", item.get("workerType"))) and current["role"] == item.get("role", "") and current["site"] == item.get("site", "") and current["valid_until"] == item.get("valid_until", item.get("validUntil", "")) and (current["visitor_company"] or "") == (item.get("visitor_company", item.get("visitorCompany", "")) or "") and (current["visit_purpose"] or "") == (item.get("visit_purpose", item.get("visitPurpose", "")) or "") and (current["host_name"] or "") == (item.get("host_name", item.get("hostName", "")) or "") and (current["visit_end_at"] or "") == (item.get("visit_end_at", item.get("visitEndAt", "")) or "") and current["status"] == item.get("status", "aktiv") and (current["badge_id"] or "") == (item.get("badge_id", item.get("badgeId", "")) or ""):
                    summary["unchanged"]["workers"] += 1
                    continue
        prepared_workers.append(
            (
                wid,
                cid,
                item.get("subcompany_id", item.get("subcompanyId")),
                item.get("first_name", item.get("firstName", "")),
                item.get("last_name", item.get("lastName", "")),
                item.get("insurance_number", item.get("insuranceNumber", "")),
                normalize_worker_type(item.get("worker_type", item.get("workerType"))),
                item.get("role", ""),
                item.get("site", ""),
                item.get("valid_until", item.get("validUntil", "")),
                item.get("visitor_company", item.get("visitorCompany", "")),
                item.get("visit_purpose", item.get("visitPurpose", "")),
                item.get("host_name", item.get("hostName", "")),
                item.get("visit_end_at", item.get("visitEndAt", "")),
                item.get("status", "aktiv"),
                item.get("photo_data", item.get("photoData", "")),
                item.get("badge_id", item.get("badgeId", "")),
                "",
                item.get("physical_card_id", item.get("physicalCardId")),
                item.get("deleted_at", item.get("deletedAt")),
            )
        )

    known_worker_ids = {row[0] for row in prepared_workers}
    if not dry_run:
        existing_worker_rows = db.execute("SELECT id, company_id FROM workers").fetchall()
        for row in existing_worker_rows:
            if company_allowed(row["company_id"]):
                known_worker_ids.add(row["id"])

    for item in access_logs:
        lid = item.get("id")
        worker_id = item.get("worker_id", item.get("workerId"))
        if not lid or not worker_id:
            summary["skipped"]["invalid"] += 1
            continue
        if worker_id not in known_worker_ids:
            summary["skipped"]["invalid"] += 1
            continue
        exists = db.execute("SELECT 1 FROM access_logs WHERE id = ?", (lid,)).fetchone()
        if exists:
            summary["conflicts"]["accessLogs"] += 1
            if import_only_changes:
                current = db.execute("SELECT * FROM access_logs WHERE id = ?", (lid,)).fetchone()
                if current and current["worker_id"] == worker_id and current["direction"] == item.get("direction", "check-in") and current["gate"] == item.get("gate", "") and current["note"] == item.get("note", "") and current["timestamp"] == item.get("timestamp", now_iso()):
                    summary["unchanged"]["accessLogs"] += 1
                    continue
        prepared_access_logs.append(
            (
                lid,
                worker_id,
                item.get("direction", "check-in"),
                item.get("gate", ""),
                item.get("note", ""),
                item.get("timestamp", now_iso()),
            )
        )

    for item in invoices:
        if role != "superadmin":
            summary["skipped"]["forbidden"] += 1
            continue
        iid = item.get("id")
        cid = item.get("company_id", item.get("companyId"))
        if not iid or not cid:
            summary["skipped"]["invalid"] += 1
            continue
        if not company_allowed(cid):
            summary["skipped"]["forbidden"] += 1
            continue
        exists = db.execute("SELECT 1 FROM invoices WHERE id = ?", (iid,)).fetchone()
        if exists:
            summary["conflicts"]["invoices"] += 1
            if import_only_changes:
                current = db.execute("SELECT * FROM invoices WHERE id = ?", (iid,)).fetchone()
                if current and current["company_id"] == cid and current["invoice_number"] == item.get("invoice_number", item.get("invoiceNumber", "")) and current["recipient_email"] == item.get("recipient_email", item.get("recipientEmail", "")) and current["invoice_date"] == item.get("invoice_date", item.get("invoiceDate", "")) and current["invoice_period"] == item.get("invoice_period", item.get("invoicePeriod", "")) and current["description"] == item.get("description", "") and float(current["total_amount"] or 0) == float(item.get("total_amount", item.get("totalAmount", 0)) or 0) and current["status"] == item.get("status", "draft"):
                    summary["unchanged"]["invoices"] += 1
                    continue
        prepared_invoices.append(
            (
                iid,
                item.get("invoice_number", item.get("invoiceNumber", "")),
                cid,
                item.get("recipient_email", item.get("recipientEmail", "")),
                item.get("invoice_date", item.get("invoiceDate", "")),
                item.get("invoice_period", item.get("invoicePeriod", "")),
                item.get("description", ""),
                float(item.get("net_amount", item.get("netAmount", 0)) or 0),
                float(item.get("vat_rate", item.get("vatRate", 0)) or 0),
                float(item.get("vat_amount", item.get("vatAmount", 0)) or 0),
                float(item.get("total_amount", item.get("totalAmount", 0)) or 0),
                item.get("status", "draft"),
                item.get("error_message", item.get("errorMessage", "")),
                item.get("sent_at", item.get("sentAt")),
                item.get("rendered_html", item.get("renderedHtml", "<html><body>Imported invoice</body></html>")),
                user.get("id"),
                item.get("created_at", item.get("createdAt", now_iso())),
                item.get("due_date", item.get("dueDate")),
                item.get("paid_at", item.get("paidAt")),
                item.get("auto_suspend_triggered_at", item.get("autoSuspendTriggeredAt")),
                int(item.get("reminder_stage", item.get("reminderStage", 0)) or 0),
                item.get("last_reminder_sent_at", item.get("lastReminderSentAt")),
                item.get("last_reminder_error", item.get("lastReminderError", "")),
            )
        )

    summary["accepted"]["companies"] = len(prepared_companies)
    summary["accepted"]["subcompanies"] = len(prepared_subcompanies)
    summary["accepted"]["workers"] = len(prepared_workers)
    summary["accepted"]["accessLogs"] = len(prepared_access_logs)
    summary["accepted"]["invoices"] = len(prepared_invoices)

    if dry_run:
        return jsonify({"ok": True, "summary": summary})

    backup_path = create_import_rollback_backup(db, role, target_company_id)

    if role == "superadmin":
        db.executemany(
            "INSERT OR REPLACE INTO companies (id, name, contact, billing_email, access_host, plan, status, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            prepared_companies,
        )

    db.executemany(
        "INSERT OR REPLACE INTO subcompanies (id, company_id, name, contact, status, deleted_at) VALUES (?, ?, ?, ?, ?, ?)",
        prepared_subcompanies,
    )
    db.executemany(
        """
        INSERT OR REPLACE INTO workers (
            id, company_id, subcompany_id, first_name, last_name, insurance_number, worker_type, role, site, valid_until,
            visitor_company, visit_purpose, host_name, visit_end_at, status, photo_data, badge_id, badge_pin_hash, physical_card_id, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        prepared_workers,
    )
    db.executemany(
        "INSERT OR REPLACE INTO access_logs (id, worker_id, direction, gate, note, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
        prepared_access_logs,
    )
    db.executemany(
        """
        INSERT OR REPLACE INTO invoices (
            id, invoice_number, company_id, recipient_email, invoice_date, invoice_period, description,
            net_amount, vat_rate, vat_amount, total_amount, status, error_message, sent_at,
            rendered_html, created_by_user_id, created_at, due_date, paid_at,
            auto_suspend_triggered_at, reminder_stage, last_reminder_sent_at, last_reminder_error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        prepared_invoices,
    )
    db.commit()

    log_audit(
        "import.applied",
        f"Import ausgefuehrt (companies={summary['accepted']['companies']}, workers={summary['accepted']['workers']}, logs={summary['accepted']['accessLogs']}, invoices={summary['accepted']['invoices']}, backup={backup_path})",
        target_type="import",
        target_id=now_iso(),
        company_id=target_company_id,
        actor=user,
    )

    return jsonify({"ok": True, "summary": summary, "backupPath": backup_path})


@app.get("/api/health")
def api_health():
    db_ok = True
    db_error = ""
    try:
        db = sqlite3.connect(DB_PATH)
        db.execute("SELECT 1").fetchone()
        db.close()
    except Exception as exc:
        db_ok = False
        db_error = str(exc)

    uptime_seconds = int((datetime.utcnow() - APP_STARTED_AT).total_seconds())
    diagnostics = get_runtime_diagnostics()
    status = "ok" if db_ok else "degraded"

    alerts = []
    try:
        alerts_db = sqlite3.connect(DB_PATH)
        alerts_db.row_factory = sqlite3.Row
        alert_rows = alerts_db.execute(
            "SELECT * FROM system_alerts ORDER BY created_at DESC LIMIT 20"
        ).fetchall()
        alerts = [row_to_dict(row) for row in alert_rows]
        alerts_db.close()
    except Exception:
        alerts = []

    if not db_ok:
        try:
            db = get_db()
            create_system_alert(db, "health_db_down", "critical", "Health-Check: Datenbank nicht erreichbar.", {"error": db_error})
        except Exception:
            pass
    elif diagnostics.get("warnings"):
        try:
            db = get_db()
            create_system_alert(
                db,
                "health_runtime_warnings",
                "warning",
                f"Health-Check meldet {len(diagnostics.get('warnings', []))} Warnungen.",
                diagnostics.get("warnings", []),
                dedup_minutes=60,
            )
        except Exception:
            pass

    return jsonify(
        {
            "status": status,
            "uptimeSeconds": uptime_seconds,
            "startedAt": APP_STARTED_AT.replace(microsecond=0).isoformat() + "Z",
            "db": {"ok": db_ok, "error": db_error},
            "dunning": {
                "lastRunAt": DUNNING_LAST_RUN_AT,
                "lastResult": DUNNING_LAST_RESULT,
                "intervalHours": max(1, int(os.getenv("BAUPASS_DUNNING_INTERVAL_HOURS", "24"))),
            },
            "warnings": diagnostics.get("warnings", []),
            "alerts": alerts,
        }
    ), (200 if db_ok else 503)


@app.get("/api/health/live")
def api_health_live():
    return jsonify({"status": "alive", "startedAt": APP_STARTED_AT.replace(microsecond=0).isoformat() + "Z"})


@app.get("/api/health/ready")
def api_health_ready():
    try:
        db = sqlite3.connect(DB_PATH)
        db.execute("SELECT 1").fetchone()
        db.close()
        return jsonify({"status": "ready"}), 200
    except Exception as exc:
        return jsonify({"status": "not_ready", "error": str(exc)}), 503


@app.get("/api/system-alerts")
@require_auth
@require_roles("superadmin", "company-admin")
def list_system_alerts():
    limit = min(max(int(request.args.get("limit", "100")), 1), 500)
    severity = (request.args.get("severity") or "").strip().lower()

    conditions = []
    params = []
    if severity:
        conditions.append("severity = ?")
        params.append(severity)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    rows = get_db().execute(
        f"SELECT * FROM system_alerts {where_clause} ORDER BY created_at DESC LIMIT ?",
        [*params, limit],
    ).fetchall()

    return jsonify([row_to_dict(row) for row in rows])


@app.get("/")
def root():
    cookie_token = request.cookies.get(SESSION_COOKIE_NAME, "")
    user = get_user_from_session_token(cookie_token)
    if not user:
        return render_login_page()
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/worker.html")
def worker_entry_redirect():
    return send_from_directory(BASE_DIR, "worker.html")


@app.get("/worker-icon-<int:icon_size>.png")
def worker_icon_png(icon_size: int):
    if icon_size not in (192, 512):
        return jsonify({"error": "not_found"}), 404
    data = _generate_icon_png(icon_size)
    if not data:
        return jsonify({"error": "icon_generation_failed"}), 500
    response = Response(data, mimetype="image/png")
    response.headers["Cache-Control"] = "public, max-age=86400"
    return response


@app.get("/<path:path>")
def static_proxy(path):
    if path.lower() == "index.html":
        cookie_token = request.cookies.get(SESSION_COOKIE_NAME, "")
        user = get_user_from_session_token(cookie_token)
        if not user:
            return render_login_page()
    target = BASE_DIR / path
    if target.exists() and target.is_file():
        return send_from_directory(BASE_DIR, path)
    return jsonify({"error": "not_found"}), 404


start_background_jobs()


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8080"))
    ssl_context = get_ssl_context_from_env()
    app.run(host=host, port=port, ssl_context=ssl_context)
