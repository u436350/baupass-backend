import os
import sqlite3
import secrets
import csv
import io
import smtplib
import ipaddress
import html
import socket
from functools import wraps
from datetime import datetime, timedelta, timezone
from pathlib import Path
from email.message import EmailMessage
from urllib.parse import quote, urlsplit, urlunsplit
from flask import Flask, jsonify, request, send_from_directory, g, Response, redirect
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.middleware.proxy_fix import ProxyFix
import pyotp
import qrcode

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "backend" / "baupass.db"

app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")




app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

from flask_cors import CORS
# CORS mit erlaubten Origins und Credentials aktivieren (kein Wildcard!)
CORS(app, supports_credentials=True, origins=[
    "http://127.0.0.1:8080",
    "http://localhost:8080",
    "https://saa-s-flow--mahmodscharif12.replit.app"
])

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


def expiry_iso(hours=SESSION_TTL_HOURS):
    return (datetime.utcnow() + timedelta(hours=hours)).replace(microsecond=0).isoformat() + "Z"


def worker_session_expiry_iso(days=30):
    return (datetime.utcnow() + timedelta(days=days)).replace(microsecond=0).isoformat() + "Z"


def normalize_company_plan(plan_value):
    plan = str(plan_value or "").strip().lower()
    return plan if plan in PLAN_NET_PRICE_EUR else "tageskarte"


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
    response.headers["Cache-Control"] = "no-store"
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
                        showError('Backend nicht erreichbar. Bitte Seite neu laden und Server pruefen.');
                        return;
                    }
                    if (!res.ok) {
                        const p = await res.json().catch(() => ({ error: 'login_failed' }));
                        const code = p.error || String(res.status);
                        if (code === 'too_many_attempts') {
                            showError('Zu viele Fehlversuche. Bitte spaeter erneut versuchen.');
                            return;
                        }
                        if (code === 'otp_required') {
                            showError('Fuer dieses Konto ist 2FA aktiv. Bitte OTP-Code eingeben.');
                            return;
                        }
                        if (code === 'otp_invalid') {
                            showError('OTP-Code ist ungueltig oder abgelaufen. Bitte neuen Code eingeben.');
                            return;
                        }
                        if (code === 'forbidden_tenant_host') {
                            showError('Dieser Zugang ist nur ueber die freigegebene Firmen-Domain erlaubt.');
                            return;
                        }
                        if (code === 'admin_ip_not_allowed') {
                            showError('Admin-Zugriff von dieser IP ist nicht erlaubt.');
                            return;
                        }
                        if (code === 'login_scope_mismatch') {
                            showError('Zugangstyp passt nicht zum Konto. Bitte Server-Admin/Firmen-Admin korrekt auswaehlen.');
                            return;
                        }
                        showError('Login fehlgeschlagen: ' + code);
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
    # Immer lokale IP für QR-Code-Links verwenden, damit Handy im WLAN zugreifen kann
    return "http://172.20.10.2:8000"


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

        CREATE TABLE IF NOT EXISTS workers (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            subcompany_id TEXT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            insurance_number TEXT NOT NULL,
            role TEXT NOT NULL,
            site TEXT NOT NULL,
            valid_until TEXT NOT NULL,
            status TEXT NOT NULL,
            photo_data TEXT NOT NULL,
            badge_id TEXT NOT NULL,
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

    if "worker_app_enabled" not in settings_columns:
        cur.execute("ALTER TABLE settings ADD COLUMN worker_app_enabled INTEGER NOT NULL DEFAULT 1")

    session_columns = [row[1] for row in cur.execute("PRAGMA table_info(sessions)").fetchall()]
    if "last_seen" not in session_columns:
        cur.execute("ALTER TABLE sessions ADD COLUMN last_seen TEXT")

    db.commit()
    db.close()


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

        g.worker = row_to_dict(worker)
        g.worker_token = token
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
    return jsonify({"status": "ok", "time": now_iso()})


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
def login():
    throttle_key = build_login_throttle_key()
    allowed, retry_after = can_attempt_login(throttle_key)
    if not allowed:
        return jsonify({"error": "too_many_attempts", "retryAfterSeconds": retry_after}), 429

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
        return jsonify({"error": "invalid_credentials"}), 401

    required_role_by_scope = {
        "server-admin": "superadmin",
        "company-admin": "company-admin",
        "turnstile": "turnstile",
    }
    required_role = required_role_by_scope.get(login_scope)
    if required_role and user["role"] != required_role:
        register_login_failure(throttle_key)
        log_audit("login.failed", f"Login-Typ passt nicht zu {username or 'unbekannt'}")
        return jsonify({"error": "login_scope_mismatch"}), 403

    if int(user["twofa_enabled"]) == 1:
        if not otp_code:
            register_login_failure(throttle_key)
            return jsonify({"error": "otp_required"}), 401
        totp = pyotp.TOTP(user["twofa_secret"])
        if not totp.verify(otp_code, valid_window=1):
            register_login_failure(throttle_key)
            return jsonify({"error": "otp_invalid"}), 401

    if not is_tenant_host_valid(db, row_to_dict(user)):
        register_login_failure(throttle_key)
        return jsonify({"error": "forbidden_tenant_host"}), 403

    clear_login_failures(throttle_key)

    token = secrets.token_urlsafe(24)
    db.execute("DELETE FROM sessions WHERE user_id = ?", (user["id"],))
    db.execute(
        "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
        (token, user["id"], expiry_iso()),
    )
    db.commit()

    log_audit("login.success", f"Benutzer {user['username']} angemeldet", target_type="user", target_id=user["id"], actor=row_to_dict(user))

    response = jsonify({"token": token, "user": serialize_user(user)})
    response.set_cookie(SESSION_COOKIE_NAME, token, httponly=True, samesite="Lax", secure=False)
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
    cookie_token = request.cookies.get(SESSION_COOKIE_NAME, "")
    user = get_user_from_session_token(cookie_token)
    if not user:
        return jsonify({"error": "unauthorized"}), 401

    db = get_db()
    if not is_tenant_host_valid(db, user):
        return jsonify({"error": "forbidden_tenant_host"}), 403

    if user.get("role") in ["superadmin", "company-admin"]:
        settings_row = db.execute("SELECT admin_ip_whitelist FROM settings WHERE id = 1").fetchone()
        whitelist = parse_ip_whitelist(settings_row["admin_ip_whitelist"] if settings_row else "")
        if whitelist and not ip_allowed(get_client_ip(), whitelist):
            return jsonify({"error": "admin_ip_not_allowed"}), 403

    db.execute("UPDATE sessions SET expires_at = ? WHERE token = ?", (expiry_iso(), cookie_token))
    db.commit()

    return jsonify({"token": cookie_token, "user": serialize_user(user)})


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

    db.execute("DELETE FROM access_logs WHERE worker_id IN (SELECT id FROM workers WHERE company_id = ?)", (company_id,))
    db.execute("DELETE FROM workers WHERE company_id = ?", (company_id,))
    db.execute("DELETE FROM subcompanies WHERE company_id = ?", (company_id,))

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
    db.commit()
    log_audit("demo.seed", "Demo-Daten wurden geladen", target_type="company", target_id=company_id, company_id=company_id, actor=g.current_user)

    return jsonify({"ok": True, "workersCreated": len(workers)})


@app.get("/api/workers")
@require_auth
def list_workers():
    include_deleted = request.args.get("includeDeleted", "0") == "1"
    clause, params = visible_worker_clause(g.current_user)
    where = clause if include_deleted else f"{clause}{' AND' if clause else ' WHERE'} deleted_at IS NULL"
    rows = get_db().execute(f"SELECT * FROM workers{where} ORDER BY last_name, first_name", params).fetchall()
    workers = []
    for row in rows:
        workers.append(
            {
                "id": row["id"],
                "companyId": row["company_id"],
                "subcompanyId": row["subcompany_id"],
                "firstName": row["first_name"],
                "lastName": row["last_name"],
                "insuranceNumber": row["insurance_number"],
                "role": row["role"],
                "site": row["site"],
                "validUntil": row["valid_until"],
                "status": row["status"],
                "photoData": row["photo_data"],
                "badgeId": row["badge_id"],
                "deletedAt": row["deleted_at"],
            }
        )
    return jsonify(workers)


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

    worker_id = f"wrk-{secrets.token_hex(6)}"
    db.execute(
        """
        INSERT INTO workers (
            id, company_id, subcompany_id, first_name, last_name, insurance_number, role, site, valid_until, status, photo_data, badge_id, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            worker_id,
            company_id,
            subcompany_id,
            payload.get("firstName", ""),
            payload.get("lastName", ""),
            payload.get("insuranceNumber", ""),
            payload.get("role", ""),
            payload.get("site", ""),
            payload.get("validUntil", ""),
            payload.get("status", "aktiv"),
            photo_data,
            payload.get("badgeId", f"BP-{secrets.token_hex(3).upper()}"),
            None,
        ),
    )
    db.commit()
    log_audit("worker.created", f"Mitarbeiter {payload.get('firstName', '')} {payload.get('lastName', '')} erstellt", target_type="worker", target_id=worker_id, company_id=company_id, actor=g.current_user)
    row = db.execute("SELECT * FROM workers WHERE id = ?", (worker_id,)).fetchone()
    return jsonify(
        {
            "id": row["id"],
            "companyId": row["company_id"],
            "subcompanyId": row["subcompany_id"],
            "firstName": row["first_name"],
            "lastName": row["last_name"],
            "insuranceNumber": row["insurance_number"],
            "role": row["role"],
            "site": row["site"],
            "validUntil": row["valid_until"],
            "status": row["status"],
            "photoData": row["photo_data"],
            "badgeId": row["badge_id"],
            "deletedAt": row["deleted_at"],
        }
    ), 201


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

    db.execute(
        """
        UPDATE workers
        SET company_id = ?, subcompany_id = ?, first_name = ?, last_name = ?, insurance_number = ?, role = ?, site = ?, valid_until = ?, status = ?, photo_data = ?
        WHERE id = ?
        """,
        (
            next_company_id,
            subcompany_id,
            payload.get("firstName", worker["first_name"]),
            payload.get("lastName", worker["last_name"]),
            payload.get("insuranceNumber", worker["insurance_number"]),
            payload.get("role", worker["role"]),
            payload.get("site", worker["site"]),
            payload.get("validUntil", worker["valid_until"]),
            payload.get("status", worker["status"]),
            updated_photo_data,
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


def build_worker_app_access_payload(db, worker_id, actor_user):
    worker = db.execute("SELECT * FROM workers WHERE id = ?", (worker_id,)).fetchone()
    if not worker:
        return None, (jsonify({"error": "worker_not_found"}), 404)

    if actor_user["role"] != "superadmin" and worker["company_id"] != actor_user.get("company_id"):
        return None, (jsonify({"error": "forbidden_worker"}), 403)

    if worker["deleted_at"]:
        return None, (jsonify({"error": "worker_deleted"}), 400)

    token_row = db.execute(
        """
        SELECT token
        FROM worker_app_tokens
        WHERE worker_id = ? AND revoked_at IS NULL AND expires_at >= ?
        ORDER BY expires_at DESC
        LIMIT 1
        """,
        (worker_id, now_iso()),
    ).fetchone()

    access_token = token_row["token"] if token_row else secrets.token_urlsafe(32)
    created = False
    if not token_row:
        db.execute(
            "INSERT INTO worker_app_tokens (token, worker_id, expires_at, revoked_at, created_by_user_id) VALUES (?, ?, ?, NULL, ?)",
            (access_token, worker_id, worker_session_expiry_iso(days=30), actor_user["id"]),
        )
        db.commit()
        created = True

    link = f"{get_public_base_url()}/worker.html?access={access_token}"
    return {
        "accessToken": access_token,
        "link": link,
        "created": created,
        "workerId": worker_id,
    }, None


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
def worker_app_login():
    payload = request.get_json(silent=True) or {}
    access_token = (payload.get("accessToken") or "").strip()
    if not access_token:
        return jsonify({"error": "missing_access_token"}), 400

    db = get_db()
    setting = db.execute("SELECT worker_app_enabled FROM settings WHERE id = 1").fetchone()
    if setting and int(setting["worker_app_enabled"]) == 0:
        return jsonify({"error": "worker_app_disabled", "message": "Die Mitarbeiter-App ist zurzeit nicht verfuegbar. Bitte spaeter erneut versuchen."}), 503
    token_row = db.execute("SELECT * FROM worker_app_tokens WHERE token = ?", (access_token,)).fetchone()
    if not token_row:
        return jsonify({"error": "invalid_access_token"}), 401

    if token_row["revoked_at"]:
        return jsonify({"error": "access_token_revoked"}), 401

    if token_row["expires_at"] < now_iso():
        return jsonify({"error": "access_token_expired"}), 401

    worker = db.execute("SELECT * FROM workers WHERE id = ?", (token_row["worker_id"],)).fetchone()
    if not worker or worker["deleted_at"]:
        return jsonify({"error": "worker_not_available"}), 401

    session_token = secrets.token_urlsafe(28)
    db.execute("INSERT INTO worker_app_sessions (token, worker_id, expires_at) VALUES (?, ?, ?)", (session_token, worker["id"], worker_session_expiry_iso(days=30)))
    db.execute("UPDATE worker_app_tokens SET revoked_at = ? WHERE token = ?", (now_iso(), access_token))
    db.commit()

    return jsonify(
        {
            "token": session_token,
            "worker": {
                "id": worker["id"],
                "subcompanyId": worker["subcompany_id"],
                "firstName": worker["first_name"],
                "lastName": worker["last_name"],
                "role": worker["role"],
                "site": worker["site"],
                "validUntil": worker["valid_until"],
                "status": worker["status"],
                "photoData": worker["photo_data"],
                "badgeId": worker["badge_id"],
            },
        }
    )


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
            "worker": {
                "id": worker["id"],
                "subcompanyId": worker["subcompany_id"],
                "firstName": worker["first_name"],
                "lastName": worker["last_name"],
                "role": worker["role"],
                "site": worker["site"],
                "validUntil": worker["valid_until"],
                "status": worker["status"],
                "photoData": worker["photo_data"],
                "badgeId": worker["badge_id"],
            },
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
    count = db.execute("SELECT COUNT(*) AS c FROM workers WHERE company_id = ? AND deleted_at IS NULL", (company_id,)).fetchone()["c"]
    if count > 0:
        return jsonify({"error": "company_has_workers"}), 400

    db.execute("UPDATE companies SET deleted_at = ?, status = ? WHERE id = ?", (now_iso(), "pausiert", company_id))
    db.commit()
    log_audit("company.deleted", f"Firma {company_id} geloescht", target_type="company", target_id=company_id, company_id=company_id, actor=g.current_user)
    return jsonify({"ok": True})


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
        fixed.append("Keine Probleme gefunden – System ist in Ordnung")

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


@app.get("/api/access-logs/day-close-check")
@require_auth
def access_day_close_check():
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

    if worker["status"] != "aktiv":
        return jsonify({"error": "worker_not_active"}), 400

    log_id = f"log-{secrets.token_hex(6)}"
    db.execute(
        "INSERT INTO access_logs (id, worker_id, direction, gate, note, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
        (
            log_id,
            worker_id,
            payload.get("direction", "check-in"),
            payload.get("gate", "Drehkreuz Nord"),
            payload.get("note", ""),
            payload.get("timestamp", now_iso()),
        ),
    )
    db.commit()
    log_audit("access.booked", f"Zutritt {payload.get('direction', 'check-in')} fuer Worker {worker_id}", target_type="worker", target_id=worker_id, company_id=worker["company_id"], actor=g.current_user)
    row = db.execute("SELECT * FROM access_logs WHERE id = ?", (log_id,)).fetchone()
    return jsonify(row_to_dict(row)), 201


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
@require_roles("superadmin", "company-admin")
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
@require_roles("superadmin", "company-admin")
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
    invoice_date = (payload.get("invoiceDate") or datetime.now().date().isoformat()).strip()
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
            rendered_html, created_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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


@app.get("/api/audit-logs")
@require_auth
@require_roles("superadmin", "company-admin")
def list_audit_logs():
    user = g.current_user
    db = get_db()
    event_type = (request.args.get("eventType") or "").strip()
    actor_role = (request.args.get("actorRole") or "").strip()
    target_type = (request.args.get("targetType") or "").strip()
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
    settings = get_settings().json
    companies = list_companies().json
    subcompanies = list_subcompanies().json
    workers = list_workers().json
    logs = list_access_logs().json
    invoices = []
    if g.current_user["role"] in ["superadmin", "company-admin"]:
        invoices = list_invoices().json
    user = g.current_user
    users = [user]

    if user["role"] == "superadmin":
        rows = get_db().execute("SELECT * FROM users ORDER BY username").fetchall()
        users = [row_to_dict(row) for row in rows]
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

    return jsonify(
        {
            "settings": settings,
            "companies": companies,
            "subcompanies": subcompanies,
            "workers": workers,
            "accessLogs": logs,
            "invoices": invoices,
            "users": users,
            "exportedAt": now_iso(),
        }
    )


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


if __name__ == "__main__":
    init_db()
    # Replit erwartet Port 8080 und host 0.0.0.0
    app.run(host="0.0.0.0", port=8080)
