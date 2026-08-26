"""Guards the env file baked into the server image (docker/Dockerfile -> /app/.env).

Notification and email links are built with full_url(), which joins paths onto
settings.SITE_URL. Pinning that to a localhost/http value makes every link in
the notification menu and in outbound mail unreachable, which is what happened
with the deployment's SITE_URL env var (ScanTrust/k8s-config#350). dotenv does
not override real env vars, so this file is only the fallback -- but a localhost
value here would be just as wrong for any deployment that relies on it.
"""

from pathlib import Path

import dotenv

SERVER_ENV = Path(__file__).resolve().parents[3] / "docker" / "config" / "server.env"


def test_server_env_does_not_pin_site_url_to_localhost():
    site_url = dotenv.dotenv_values(SERVER_ENV).get("SITE_URL")
    assert site_url is None or site_url.startswith("https://"), (
        f"SITE_URL={site_url!r} would make notification and email links unreachable"
    )
