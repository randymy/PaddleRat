from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models import Contact, PlayerTeam, Series, Team, User
from app.utils import normalize_phone

router = APIRouter(prefix="/directory", tags=["directory"])


class DirectoryPlayer(BaseModel):
    id: int
    name: str
    pti: float | None
    has_phone: bool = False

    model_config = {"from_attributes": True}


class DirectoryResponse(BaseModel):
    players: list[DirectoryPlayer]
    total: int


class SeriesOut(BaseModel):
    id: int
    name: str
    team_count: int


class TeamOut(BaseModel):
    id: int
    name: str
    series_name: str


class TeamPlayer(BaseModel):
    id: int
    name: str
    pti: float | None
    has_phone: bool


class AddPlayerRequest(BaseModel):
    phone: str | None = None


# ── Opted-in directory ───────────────────────────

@router.get("", response_model=DirectoryResponse)
async def list_directory(
    search: str = Query(default="", description="Search by name"),
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List players who opted in to share their info with the community."""
    query = (
        select(User)
        .where(User.phone_public == True, User.phone.isnot(None))
        .where(User.id != user.id)
    )
    if search:
        query = query.where(User.name.ilike(f"%{search}%"))

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    result = await db.execute(
        query.order_by(User.name).limit(limit).offset(offset)
    )
    players = [
        DirectoryPlayer(id=u.id, name=u.name, pti=u.pti, has_phone=bool(u.phone))
        for u in result.scalars().all()
    ]

    return DirectoryResponse(players=players, total=total)


# ── Browse by series/team ────────────────────────

@router.get("/series", response_model=list[SeriesOut])
async def list_series(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all series/divisions with team count."""
    result = await db.execute(
        select(
            Series.id,
            Series.name,
            func.count(Team.id).label("team_count"),
        )
        .outerjoin(Team, Team.series_id == Series.id)
        .group_by(Series.id)
        .order_by(Series.name)
    )
    return [
        SeriesOut(id=row.id, name=row.name, team_count=row.team_count)
        for row in result.all()
    ]


@router.get("/series/{series_id}/teams", response_model=list[TeamOut])
async def list_teams(
    series_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List teams in a series."""
    series = await db.get(Series, series_id)
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")

    result = await db.execute(
        select(Team).where(Team.series_id == series_id).order_by(Team.name)
    )
    return [
        TeamOut(id=t.id, name=t.name, series_name=series.name)
        for t in result.scalars().all()
    ]


@router.get("/teams/{team_id}/players", response_model=list[TeamPlayer])
async def list_team_players(
    team_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List players on a team."""
    result = await db.execute(
        select(User)
        .join(PlayerTeam, PlayerTeam.player_id == User.id)
        .where(PlayerTeam.team_id == team_id)
        .order_by(User.name)
    )
    return [
        TeamPlayer(id=u.id, name=u.name, pti=u.pti, has_phone=bool(u.phone))
        for u in result.scalars().all()
    ]


# ── Add player to contacts ──────────────────────

@router.post("/add/{user_id}")
async def add_from_directory(
    user_id: int,
    body: AddPlayerRequest = AddPlayerRequest(),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a player to your contacts. If they don't have a phone, provide one."""
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Player not found")

    # If player has no phone and one was provided, link it
    if not target.phone and body.phone:
        phone = normalize_phone(body.phone)
        # Check phone isn't taken
        existing = await db.execute(select(User).where(User.phone == phone))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Phone number already registered to another player")
        target.phone = phone
        target.invited_by_id = user.id
        await db.flush()

    # Check if already a contact
    result = await db.execute(
        select(Contact).where(
            Contact.owner_id == user.id, Contact.user_id == user_id
        )
    )
    if result.scalar_one_or_none():
        return {"status": "already_added"}

    contact = Contact(owner_id=user.id, user_id=user_id, nickname=target.name)
    db.add(contact)
    await db.commit()
    return {"status": "added", "has_phone": bool(target.phone)}
