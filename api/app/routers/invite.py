import secrets

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models import Contact, User
from app.utils import normalize_phone

router = APIRouter(prefix="/invite", tags=["invite"])

# In-memory store for invite links (swap for DB/Redis in production)
_invite_links: dict[str, dict] = {}


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
    _invite_links[code] = {
        "ratking_id": user.id,
        "ratking_name": user.name,
    }

    return InviteLinkResponse(
        code=code,
        link=f"/join/{code}",
        ratking_name=user.name,
    )


@router.get("/link/{code}")
async def get_invite_info(code: str):
    """Public endpoint: get info about an invite link."""
    data = _invite_links.get(code)
    if not data:
        raise HTTPException(status_code=404, detail="Invalid or expired invite link")
    return {"ratking_name": data["ratking_name"]}


@router.get("/search", response_model=list[PlayerSearchResult])
async def search_players(
    q: str = Query(..., min_length=2, description="Name search query"),
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint: search APTA players by name for the join flow."""
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
    # Validate invite code
    invite = _invite_links.get(body.code)
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid or expired invite link")

    phone = normalize_phone(body.phone)

    # Check if this phone is already registered
    result = await db.execute(select(User).where(User.phone == phone))
    existing_by_phone = result.scalar_one_or_none()

    # Get the selected APTA player
    player = await db.get(User, body.user_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    if existing_by_phone and existing_by_phone.id != player.id:
        # Phone belongs to a different user
        raise HTTPException(
            status_code=400,
            detail="This phone number is already registered to a different player"
        )

    # Link phone to the APTA player record
    if not player.phone:
        player.phone = phone
        await db.flush()

    # Create contact link to the RatKing (skip if already exists)
    ratking_id = invite["ratking_id"]
    result = await db.execute(
        select(Contact).where(
            Contact.owner_id == ratking_id,
            Contact.user_id == player.id,
        )
    )
    if not result.scalar_one_or_none():
        contact = Contact(
            owner_id=ratking_id,
            user_id=player.id,
            nickname=player.name,
        )
        db.add(contact)

    await db.commit()

    return JoinResponse(
        status="joined",
        name=player.name,
        pti=player.pti,
        message=f"You're connected with {invite['ratking_name']}!",
    )
