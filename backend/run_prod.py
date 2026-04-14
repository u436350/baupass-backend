import socket
import sys
import os

from waitress import serve

from server import app, get_runtime_diagnostics, init_db, check_and_apply_overdue_suspensions, run_invoice_dunning_cycle, get_db


HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))


def port_is_listening(host, port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.4)
        return sock.connect_ex((host, port)) == 0


if __name__ == "__main__":
    if port_is_listening(HOST, PORT):
        print(f"Server already running on http://{HOST}:{PORT}")
        sys.exit(0)

    init_db()
    with app.app_context():
        db = get_db()
        dunning_result = run_invoice_dunning_cycle(db)
        suspended = check_and_apply_overdue_suspensions(db)
    if dunning_result.get("remindersSent") or dunning_result.get("reminderFailures") or dunning_result.get("overdueUpdated"):
        print(
            "[baupass] Dunning cycle: "
            f"sent={dunning_result.get('remindersSent', 0)}, "
            f"failed={dunning_result.get('reminderFailures', 0)}, "
            f"overdue_updated={dunning_result.get('overdueUpdated', 0)}"
        )
    if suspended:
        print(f"[baupass] Auto-suspended {len(suspended)} company/ies due to overdue invoices")
    diagnostics = get_runtime_diagnostics()
    warnings = diagnostics.get("warnings", [])
    print(f"[baupass] Runtime-Check: {len(warnings)} Warnung(en)")
    for warning in warnings:
        print(f"[baupass][warn] {warning['code']}: {warning['message']}")
    serve(app, host=HOST, port=PORT, threads=8)
