import secrets
from datetime import datetime, timedelta, timezone

import jwt

from app.config import settings

# In-memory store for magic link tokens (swap for Redis in production)
_pending_tokens: dict[str, dict] = {}


def create_magic_token(user_id: int, email: str) -> str:
    """Generate a magic link token and store it."""
    token = secrets.token_urlsafe(32)
    _pending_tokens[token] = {
        "user_id": user_id,
        "email": email,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=settings.magic_link_expiry_minutes),
    }
    return token


def verify_magic_token(token: str) -> dict | None:
    """Verify a magic link token. Token stays valid for 30s after first use."""
    data = _pending_tokens.get(token)
    if not data:
        return None
    if datetime.now(timezone.utc) > data["expires_at"]:
        _pending_tokens.pop(token, None)
        return None
    # On first use, shorten expiry to 30s so the token can't be reused long-term
    if "first_used" not in data:
        data["first_used"] = True
        data["expires_at"] = datetime.now(timezone.utc) + timedelta(seconds=30)
    return data


def create_jwt(user_id: int, role: str) -> str:
    """Create a JWT for an authenticated user."""
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expiry_hours),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_jwt(token: str) -> dict | None:
    """Decode and validate a JWT. Returns payload or None."""
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
