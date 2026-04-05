from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_db
from app.models import User
from app.services.auth import create_jwt, create_magic_token, verify_magic_token
from app.services.email import email_client

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


class LoginRequest(BaseModel):
    email: EmailStr


class TokenResponse(BaseModel):
    token: str
    user: dict


@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Send a magic link to the user's email."""
    result = await db.execute(select(User).where(User.email.ilike(body.email)))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="No account found with that email")

    if user.role not in ("ratking", "admin"):
        raise HTTPException(status_code=403, detail="Only matchmakers and admins can log in")

    token = await create_magic_token(db, user.id)
    await db.commit()
    link = f"{settings.app_url}/login?token={token}"

    email_client.send(
        to_email=user.email,
        subject="PaddleRat Login Link",
        body=f"Click to log in: {link}\n\nThis link expires in {settings.magic_link_expiry_minutes} minutes.",
    )

    response = {"status": "magic_link_sent", "message": f"Check your email ({body.email})"}
    if settings.app_url.startswith("http://localhost"):
        response["_dev_link"] = link
    return response


@router.get("/verify")
async def verify(token: str, db: AsyncSession = Depends(get_db)):
    """Verify a magic link token and return a JWT."""
    data = await verify_magic_token(db, token)
    await db.commit()
    if not data:
        raise HTTPException(status_code=401, detail="Invalid or expired link")

    user = await db.get(User, data["user_id"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    jwt_token = create_jwt(user.id, user.role)

    return {
        "token": jwt_token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "pti": user.pti,
        },
    }
