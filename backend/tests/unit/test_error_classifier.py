"""Tests for external network and DNS error classification."""
import httpx
from app.core.exceptions import ExternalApiException
from app.services.error_classifier import classify_external_network_error


def test_classify_dns_resolution_failure():
    exc = httpx.ConnectError("[Errno 11001] getaddrinfo failed")
    classified = classify_external_network_error(exc, service="IGDB")

    assert isinstance(classified, ExternalApiException)
    assert classified.code == "DNS_RESOLUTION_FAILED"
    assert classified.status_code == 503
    assert "DNS settings" in classified.message
    assert "offline" in classified.message.lower()
    assert classified.details["offline"] is True


def test_classify_connection_offline_failure():
    exc = httpx.ConnectError("Network is unreachable")
    classified = classify_external_network_error(exc, service="Twitch")

    assert classified.code == "OFFLINE_NO_INTERNET"
    assert classified.status_code == 503
    assert "internet connection" in classified.message.lower()


def test_classify_timeout_failure():
    exc = httpx.ConnectTimeout("Request timed out")
    classified = classify_external_network_error(exc, service="IGDB")

    assert classified.code == "IGDB_TIMEOUT"
    assert classified.status_code == 504
    assert "timed out" in classified.message.lower()
