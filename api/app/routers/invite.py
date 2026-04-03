import secrets

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models import Contact, InviteLink, User
from app.utils import normalize_phone

router = APIRouter(prefix="/invite", tags=["invite"])


class InviteLinkResponse(BaseModel):
    code: str
    link: str
    ratking_name: str


class PlayerSearchResult(BaseModel):
    id: int
    name: str
    pti: float | None

    model_config = {"from_attributes": True}


class JoinRequest(BaseModel):
    code: str
    user_id: int
    phone: str


class JoinResponse(BaseModel):
    status: str
    name: str
    pti: float | None
    message: str


@router.post("/link", response_model=InviteLinkResponse)
async def create_invite_link(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """RatKing generates a shareable invite link."""
    if user.role not in ("ratking", "admin"):
        raise HTTPException(status_code=403, detail="Only RatKings can create invite links")

    code = secrets.token_urlsafe(8)
    link = InviteLink(code=code, ratking_id=user.id)
    db.add(link)
    await db.commit()

    return InviteLinkResponse(
        code=code,
        link=f"/join/{code}",
        ratking_name=user.name,
    )


@router.get("/link/{code}")
async def get_invite_info(code: str, db: AsyncSession = Depends(get_db)):
    """Public endpoint: get info about an invite link."""
    result = await db.execute(
        select(InviteLink)
        .where(InviteLink.code == code)
        .options(selectinload(InviteLink.ratking))
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Invalid or expired invite link")
    return {"ratking_name": link.ratking.name}


@router.get("/search", response_model=list[PlayerSearchResult])
async def search_players(
    q: str = Query(..., min_length=2, description="Name search query"),
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint: search players by name for the join flow."""
    result = await db.execute(
        select(User)
        .where(User.name.ilike(f"%{q}%"))
        .order_by(User.name)
        .limit(10)
    )
    return result.scalars().all()


@router.post("/join", response_model=JoinResponse)
async def join_via_link(
    body: JoinRequest,
    db: AsyncSession = Depends(get_db),
):
    """Rat self-registers via an invite link."""
    result = await db.execute(
        select(InviteLink)
        .where(InviteLink.code == body.code)
        .options(selectinload(InviteLink.ratking))
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Invalid or expired invite link")

    phone = normalize_phone(body.phone)

    # Check if this phone is already registered
    result = await db.execute(select(User).where(User.phone == phone))
    existing_by_phone = result.scalar_one_or_none()

    # Get the selected player
    player = await db.get(User, body.user_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    if existing_by_phone and existing_by_phone.id != player.id:
        raise HTTPException(
            status_code=400,
            detail="This phone number is already registered to a different player"
        )

    # Link phone to the player record
    if not player.phone:
        player.phone = phone

    # Track who invited this player (for compliance)
    if not player.invited_by_id:
        player.invited_by_id = link.ratking_id

    await db.flush()

    # Create contact link to the RatKing (skip if already exists)
    result = await db.execute(
        select(Contact).where(
            Contact.owner_id == link.ratking_id,
            Contact.user_id == player.id,
        )
    )
    if not result.scalar_one_or_none():
        contact = Contact(
            owner_id=link.ratking_id,
            user_id=player.id,
            nickname=player.name,
        )
        db.add(contact)

    await db.commit()

    return JoinResponse(
        status="joined",
        name=player.name,
        pti=player.pti,
        message=f"You're connected with {link.ratking.name}!",
    )


class OptInRequest(BaseModel):
    user_id: int
    phone_public: bool


@router.post("/opt-in")
async def set_phone_public(
    body: OptInRequest,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint: Rat opts in/out of the player directory."""
    user = await db.get(User, body.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.phone_public = body.phone_public
    await db.commit()
    return {"status": "updated", "phone_public": user.phone_public}
