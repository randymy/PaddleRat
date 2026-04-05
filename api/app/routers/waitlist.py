from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models import User, Waitlist
from app.services.auth import create_magic_token
from app.services.email import email_client
from app.config import settings

router = APIRouter(tags=["waitlist"])
limiter = Limiter(key_func=get_remote_address)


class WaitlistRequest(BaseModel):
    name: str
    email: EmailStr


class WaitlistResponse(BaseModel):
    status: str
    message: str


class WaitlistEntry(BaseModel):
    id: int
    name: str
    email: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


@router.post("/waitlist", response_model=WaitlistResponse)
@limiter.limit("5/minute")
async def join_waitlist(
    request: Request,
    body: WaitlistRequest,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint: sign up for the waitlist."""
    # Check if already on waitlist
    result = await db.execute(select(Waitlist).where(Waitlist.email == body.email))
    existing = result.scalar_one_or_none()

    if existing:
        if existing.status == "approved":
            return WaitlistResponse(
                status="approved",
                message="You're already approved! Check your email for a login link.",
            )
        return WaitlistResponse(
            status="already_on_list",
            message="You're already on the waitlist. We'll be in touch!",
        )

    entry = Waitlist(name=body.name, email=body.email)
    db.add(entry)
    await db.commit()

    # Notify admin
    if settings.admin_email:
        email_client.send(
            to_email=settings.admin_email,
            subject=f"New PaddleRat waitlist signup: {body.name}",
            body=f"{body.name} ({body.email}) just signed up for the waitlist.\n\nApprove them at {settings.app_url}/admin",
        )

    return WaitlistResponse(
        status="joined",
        message="You're on the list! We'll send you a login link when it's your turn.",
    )


@router.get("/admin/waitlist", response_model=list[WaitlistEntry])
async def list_waitlist(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin: view all waitlist entries."""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.execute(select(Waitlist).order_by(Waitlist.created_at.desc()))
    return result.scalars().all()


@router.post("/admin/waitlist/{entry_id}/approve", response_model=WaitlistEntry)
async def approve_waitlist(
    entry_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin: approve a waitlist entry — creates RatKing account and sends login link."""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    entry = await db.get(Waitlist, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    if entry.status == "approved":
        raise HTTPException(status_code=400, detail="Already approved")

    # Create the RatKing user
    result = await db.execute(select(User).where(User.email == entry.email))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        existing_user.role = "ratking"
        existing_user.email = entry.email
        ratking = existing_user
    else:
        ratking = User(name=entry.name, email=entry.email, role="ratking")
        db.add(ratking)

    entry.status = "approved"
    entry.approved_at = datetime.now(timezone.utc)
    await db.flush()

    # Send them a magic link
    token = await create_magic_token(db, ratking.id)
    link = f"{settings.app_url}/login?token={token}"

    email_client.send(
        to_email=entry.email,
        subject="Welcome to PaddleRat — You're In!",
        body=f"You've been approved as a Matchmaker on PaddleRat!\n\nClick to log in: {link}",
    )

    await db.commit()
    return entry
