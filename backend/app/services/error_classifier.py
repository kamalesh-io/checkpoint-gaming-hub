"""Utility for classifying external API network, DNS, and connection errors."""
from app.core.exceptions import ExternalApiException


def classify_external_network_error(exc: Exception, service: str = "IGDB") -> ExternalApiException:
    """Classifies raw socket/httpx errors into clean structured exceptions with user-friendly messages."""
    err_str = str(exc).lower()

    # DNS resolution failure (e.g. [Errno 11001] getaddrinfo failed on Windows)
    if any(k in err_str for k in ("11001", "getaddrinfo", "nameresolution", "nodename nor servname", "gaierror")):
        return ExternalApiException(
            message=f"Unable to reach {service}. Please check your internet connection or DNS settings. Your local library remains fully accessible offline.",
            code="DNS_RESOLUTION_FAILED",
            status_code=503,
            details={"service": service, "offline": True, "category": "dns"},
        )

    # General connection/offline failures
    if any(k in err_str for k in ("connecterror", "connection refused", "network is unreachable", "no route to host", "connection reset")):
        return ExternalApiException(
            message=f"Unable to connect to {service}. Please verify your internet connection. Your local library remains fully accessible offline.",
            code="OFFLINE_NO_INTERNET",
            status_code=503,
            details={"service": service, "offline": True, "category": "offline"},
        )

    # Timeouts
    if any(k in err_str for k in ("timeout", "timed out")):
        return ExternalApiException(
            message=f"Connection to {service} timed out. Please check your network connection and try again.",
            code=f"{service.upper()}_TIMEOUT",
            status_code=504,
            details={"service": service, "category": "timeout"},
        )

    # General unreachable
    return ExternalApiException(
        message=f"{service} service is temporarily unreachable. Your local library remains fully accessible offline.",
        code=f"{service.upper()}_SERVICE_UNREACHABLE",
        status_code=503,
        details={"service": service, "category": "unreachable"},
    )
