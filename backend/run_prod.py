import socket
import sys
import os

from waitress import serve

from server import app, init_db


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
    serve(app, host=HOST, port=PORT, threads=8)
