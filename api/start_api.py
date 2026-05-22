"""Run API migrations after the database endpoint is reachable."""

from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
from urllib.parse import urlsplit

DEFAULT_DB_WAIT_TIMEOUT_SECONDS = 90.0
DEFAULT_DB_WAIT_INTERVAL_SECONDS = 2.0
DEFAULT_UVICORN_COMMAND = [
    "uvicorn",
    "main:app",
    "--host",
    "0.0.0.0",
    "--port",
    "8000",
]
DATABASE_PORTS = {
    "mariadb": 3306,
    "mysql": 3306,
    "postgres": 5432,
    "postgresql": 5432,
}


def database_endpoint(database_url: str | None) -> tuple[str, int] | None:
    """Return the TCP endpoint for networked database URLs."""
    if not database_url:
        return None

    parsed = urlsplit(database_url)
    dialect = parsed.scheme.split("+", maxsplit=1)[0]
    default_port = DATABASE_PORTS.get(dialect)
    if not parsed.hostname or default_port is None:
        return None

    return parsed.hostname, parsed.port or default_port


def wait_for_database(database_url: str | None) -> None:
    endpoint = database_endpoint(database_url)
    if endpoint is None:
        return

    host, port = endpoint
    timeout = float(os.getenv("DB_WAIT_TIMEOUT_SECONDS", DEFAULT_DB_WAIT_TIMEOUT_SECONDS))
    interval = float(os.getenv("DB_WAIT_INTERVAL_SECONDS", DEFAULT_DB_WAIT_INTERVAL_SECONDS))
    deadline = time.monotonic() + timeout
    attempt = 0
    last_error: OSError | None = None

    while time.monotonic() < deadline:
        attempt += 1
        try:
            with socket.create_connection((host, port), timeout=min(interval, 5.0)):
                if attempt > 1:
                    print(f"Database endpoint {host}:{port} is reachable.", flush=True)
                return
        except OSError as error:
            last_error = error
            if attempt == 1 or attempt % 3 == 0:
                print(f"Waiting for database endpoint {host}:{port}: {error}", flush=True)
            time.sleep(interval)

    raise TimeoutError(
        f"Database endpoint {host}:{port} was not reachable within {timeout:.0f}s."
    ) from last_error


def main() -> None:
    wait_for_database(os.getenv("DATABASE_URL"))
    subprocess.run(["alembic", "upgrade", "head"], check=True)

    command = sys.argv[1:] or DEFAULT_UVICORN_COMMAND
    os.execvp(command[0], command)


if __name__ == "__main__":
    main()
