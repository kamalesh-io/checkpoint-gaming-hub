"""Unit tests for loopback security and X-Checkpoint-Token authentication."""

import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_health_public_endpoint():
    """Verify health endpoint is accessible without token."""
    transport = ASGITransport(app=app, client=("127.0.0.1", 50000))
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/v1/system/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ("ok", "healthy")
        assert "database" in data


@pytest.mark.asyncio
async def test_protected_endpoint_without_token():
    """Verify protected endpoints reject requests missing X-Checkpoint-Token."""
    transport = ASGITransport(app=app, client=("127.0.0.1", 50000))
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/v1/library/")
        assert response.status_code == 401
        data = response.json()
        assert data["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_protected_endpoint_with_invalid_token():
    """Verify protected endpoints reject invalid X-Checkpoint-Token."""
    transport = ASGITransport(app=app, client=("127.0.0.1", 50000))
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(
            "/api/v1/library/",
            headers={"X-Checkpoint-Token": "completely-invalid-token"}
        )
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_non_loopback_rejected():
    """Verify requests from non-loopback IP addresses are blocked with 403 Forbidden."""
    # Simulate an external client connection
    transport = ASGITransport(app=app, client=("192.168.1.50", 50000))
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(
            "/api/v1/system/health",
            headers={"X-Checkpoint-Token": "test-secret-token-12345"}
        )
        assert response.status_code == 403
