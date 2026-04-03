import secrets
from datetime import datetime, timedelta, timezone

import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import MagicToken


async def create_magic_token(db: AsyncSession, user_id: int) -> str:
    """Generate a magic link token and store in DB."""
    token = secrets.token_urlsafe(32)
    record = MagicToken(
        token=token,
        user_id=user_id,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.magic_link_expiry_minutes),
    )
    db.add(record)
    await db.flush()
    return token


async def verify_magic_token(db: AsyncSession, token: str) -> dict | None:
    """Verify a magic link token. Marks as used but allows reuse for 30s."""
    result = await db.execute(select(MagicToken).where(MagicToken.token == token))
    record = result.scalar_one_or_none()
    if not record:
        return None
    if datetime.now(timezone.utc) > record.expires_at:
        return None
    # On first use, shorten expiry to 30s
    if not record.used:
        record.used = True
        record.expires_at = datetime.now(timezone.utc) + timedelta(seconds=30)
        await db.flush()
    return {"user_id": record.user_id}


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
