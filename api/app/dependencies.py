from collections.abc import AsyncGenerator

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session
from app.models import User
from app.services.auth import decode_jwt


async def get_db() -> AsyncGenerator[AsyncSession]:
    async with async_session() as session:
        yield session


async def get_current_user(
    authorization: str | None = Header(default=None),
    x_user_id: int | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Authenticate via JWT. X-User-Id fallback only in local dev."""
    user_id = None

    # Try JWT first
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        payload = decode_jwt(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        user_id = int(payload["sub"])

    # Fall back to X-User-Id header ONLY in local dev
    elif x_user_id is not None and settings.app_url.startswith("http://localhost"):
        user_id = x_user_id

    else:
        raise HTTPException(status_code=401, detail="Missing authorization")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
