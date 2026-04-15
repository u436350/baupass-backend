import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

import pytest

# Make backend/server.py importable when pytest is run from the repo root.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import server


@pytest.fixture()
def client_and_db(tmp_path, monkeypatch):
    db_path = tmp_path / "baupass-test.db"
    monkeypatch.setattr(server, "DB_PATH", db_path)
    server.request_rate_state.clear()
    server.failed_login_attempts.clear()
    server.init_db()
    server.app.config.update(TESTING=True)

    with server.app.test_client() as client:
        yield client, db_path


def _auth_headers(client):
    response = client.post(
        "/api/login",
        json={
            "username": "superadmin",
            "password": "1234",
            "loginScope": "server-admin",
        },
    )
    assert response.status_code == 200
    payload = response.get_json()
    return {"Authorization": f"Bearer {payload['token']}"}


def _visitor_payload(visit_end_at, **overrides):
    payload = {
        "companyId": "cmp-default",
        "firstName": "Lena",
        "lastName": "Gast",
        "workerType": "visitor",
        "role": "Besucher",
        "site": "Nordtor",
        "status": "aktiv",
        "photoData": "data:image/png;base64,AAA",
        "visitorCompany": "Muster AG",
        "visitPurpose": "Sicherheitsbegehung",
        "hostName": "Herr Bauleiter",
        "visitEndAt": visit_end_at,
    }
    payload.update(overrides)
    return payload


def _local_datetime_string(delta_hours):
    target = datetime.now() + timedelta(hours=delta_hours)
    return target.strftime("%Y-%m-%dT%H:%M")


def test_create_visitor_requires_domain_fields(client_and_db):
    client, _ = client_and_db
    headers = _auth_headers(client)

    invalid_payload = _visitor_payload(_local_datetime_string(3), visitorCompany="")
    response = client.post("/api/workers", json=invalid_payload, headers=headers)

    assert response.status_code == 400
    assert response.get_json()["error"] == "visitor_company_required"


def test_visitor_access_token_is_one_time(client_and_db):
    client, _ = client_and_db
    headers = _auth_headers(client)

    create_response = client.post(
        "/api/workers",
        json=_visitor_payload(_local_datetime_string(5)),
        headers=headers,
    )
    assert create_response.status_code == 201
    worker_id = create_response.get_json()["id"]

    access_response = client.post(f"/api/workers/{worker_id}/app-access", headers=headers)
    assert access_response.status_code == 200
    access_token = access_response.get_json()["accessToken"]

    login_response = client.post("/api/worker-app/login", json={"accessToken": access_token})
    assert login_response.status_code == 200
    assert "token" in login_response.get_json()

    second_login_response = client.post("/api/worker-app/login", json={"accessToken": access_token})
    assert second_login_response.status_code == 401
    assert second_login_response.get_json()["error"] == "access_token_already_used"


def test_expired_visitor_cannot_get_app_access(client_and_db):
    client, _ = client_and_db
    headers = _auth_headers(client)

    create_response = client.post(
        "/api/workers",
        json=_visitor_payload(_local_datetime_string(-2)),
        headers=headers,
    )
    assert create_response.status_code == 201
    worker_id = create_response.get_json()["id"]

    access_response = client.post(f"/api/workers/{worker_id}/app-access", headers=headers)
    assert access_response.status_code == 400
    assert access_response.get_json()["error"] == "visitor_visit_expired"


def test_expired_visitor_is_auto_checked_out_in_summary(client_and_db):
    client, db_path = client_and_db
    headers = _auth_headers(client)

    create_response = client.post(
        "/api/workers",
        json=_visitor_payload(_local_datetime_string(5)),
        headers=headers,
    )
    assert create_response.status_code == 201
    worker_id = create_response.get_json()["id"]

    check_in_response = client.post(
        "/api/access-logs",
        json={
            "workerId": worker_id,
            "direction": "check-in",
            "gate": "Nordtor",
            "note": "Testeintritt",
        },
        headers=headers,
    )
    assert check_in_response.status_code == 201

    past_visit_end = (datetime.now(timezone.utc) - timedelta(minutes=5)).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    with sqlite3.connect(db_path) as db:
        db.execute("UPDATE workers SET visit_end_at = ? WHERE id = ?", (past_visit_end, worker_id))
        db.commit()

    summary_response = client.get("/api/access-logs/summary", headers=headers)
    assert summary_response.status_code == 200

    with sqlite3.connect(db_path) as db:
        row = db.execute(
            """
            SELECT COUNT(*)
            FROM access_logs
            WHERE worker_id = ?
              AND direction = 'check-out'
              AND note = 'Automatischer Austritt nach Besucher-Ende'
            """,
            (worker_id,),
        ).fetchone()

    assert row is not None
    assert int(row[0]) >= 1
