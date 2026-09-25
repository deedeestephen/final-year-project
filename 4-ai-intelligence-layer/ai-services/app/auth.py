"""Service-to-service authentication: only the backend may call this service."""

import hmac
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import Settings, get_settings

_bearer = HTTPBearer(auto_error=False)


def require_service_token(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    if not settings.service_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI_SERVICE_TOKEN is not configured",
        )
    presented = credentials.credentials if credentials else ""
    # Constant-time comparison, so the token cannot be guessed byte by byte.
    if not hmac.compare_digest(presented.encode(), settings.service_token.encode()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid service token",
            headers={"WWW-Authenticate": "Bearer"},
        )
