"""Domain exceptions for CHECKPOINT Gaming Hub."""
from typing import Any, Dict, Optional


class CheckpointException(Exception):
    """Base exception for CHECKPOINT application errors."""

    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_ERROR",
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}


class EntityNotFoundException(CheckpointException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code="NOT_FOUND",
            status_code=404,
            details=details,
        )


# Alias for backward/domain compatibility
class ResourceNotFoundException(EntityNotFoundException):
    def __init__(self, resource: str, identifier: Any):
        super().__init__(
            message=f"{resource} with identifier '{identifier}' not found.",
            details={"resource": resource, "identifier": str(identifier)},
        )


class ValidationException(CheckpointException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            status_code=422,
            details=details,
        )


class DuplicateEntityException(CheckpointException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code="DUPLICATE_ENTITY",
            status_code=409,
            details=details,
        )


class AuthenticationException(CheckpointException):
    def __init__(self, message: str = "Unauthorized access", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code="UNAUTHORIZED",
            status_code=401,
            details=details,
        )


class SecurityException(CheckpointException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code="SECURITY_VIOLATION",
            status_code=403,
            details=details,
        )


class ExternalApiException(CheckpointException):
    def __init__(self, message: str, code: str = "EXTERNAL_API_ERROR", status_code: int = 502, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code=code,
            status_code=status_code,
            details=details,
        )


class RateLimitException(CheckpointException):
    def __init__(self, message: str = "Rate limit exceeded", retry_after: Optional[float] = None):
        super().__init__(
            message=message,
            code="RATE_LIMIT_EXCEEDED",
            status_code=429,
            details={"retry_after": retry_after} if retry_after else {},
        )
