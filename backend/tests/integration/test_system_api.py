"""Integration tests for System and Integrations API endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_system_endpoints(client: AsyncClient):
    """Verify health, status, integrations, and stats endpoints."""
    # 1. Health check
    res = await client.get("/api/v1/system/health")
    assert res.status_code == 200
    assert res.json()["status"] in ("ok", "healthy")

    # 2. Status overview + cryptographic readiness proof
    import hashlib
    import hmac
    from app.core.config import settings

    nonce = "test_readiness_nonce_99"
    res = await client.get(
        "/api/v1/system/status",
        headers={"X-Checkpoint-Nonce": nonce},
    )
    assert res.status_code == 200
    status_data = res.json()
    assert status_data["status"] in ("healthy", "ok")
    assert "database" in status_data
    assert "version" in status_data
    expected_proof = hmac.new(
        settings.get_auth_token_str().encode("utf-8"),
        nonce.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    assert res.headers.get("X-Checkpoint-Proof") == expected_proof

    # 3. Integrations status
    res = await client.get("/api/v1/system/integrations")
    assert res.status_code == 200
    integrations = res.json()
    assert "igdb_connected" in integrations
    assert "steamgriddb_connected" in integrations

    # 4. Library statistics
    res = await client.get("/api/v1/system/stats")
    assert res.status_code == 200
    stats = res.json()
    assert "total_library_games" in stats
    assert "completed_games" in stats


@pytest.mark.asyncio
async def test_credentials_and_shutdown_endpoints(client: AsyncClient, tmp_path, monkeypatch):
    """Verify credentials update endpoint persists to temp data dir and shutdown triggers callback."""
    import asyncio
    from app.api.v1 import system as system_module
    from app.core.config import settings

    monkeypatch.setenv("CHECKPOINT_DATA_DIR", str(tmp_path))

    orig_id = settings.IGDB_CLIENT_ID
    orig_secret = settings.IGDB_CLIENT_SECRET
    orig_sgdb = settings.STEAMGRIDDB_API_KEY
    orig_trigger = system_module._shutdown_trigger

    triggered = False

    def fake_shutdown():
        nonlocal triggered
        triggered = True

    try:
        res = await client.post(
            "/api/v1/system/credentials",
            json={
                "igdb_client_id": "unit_igdb_id",
                "igdb_client_secret": "unit_igdb_secret",
                "steamgriddb_api_key": "unit_sgdb_key",
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["igdb_connected"] is True
        assert body["steamgriddb_connected"] is True
        assert (tmp_path / "credentials.json").exists()

        system_module.register_shutdown_trigger(fake_shutdown)
        shutdown_res = await client.post("/api/v1/system/shutdown")
        assert shutdown_res.status_code == 200
        assert shutdown_res.json()["status"] == "shutting_down"
        await asyncio.sleep(0)
        assert triggered is True
    finally:
        settings.IGDB_CLIENT_ID = orig_id
        settings.IGDB_CLIENT_SECRET = orig_secret
        settings.STEAMGRIDDB_API_KEY = orig_sgdb
        system_module._shutdown_trigger = orig_trigger
