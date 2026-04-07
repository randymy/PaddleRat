from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models import Contact, GroupMember, Invitation, InviteLink, MagicToken, PlayerTeam, Series, Session, Team, User
from app.schemas import UserCreate, UserOut, UserRoleUpdate

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(user: User):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/users", response_model=list[UserOut])
async def list_users(
    search: str = Query(default="", description="Search by name"),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(user)
    query = select(User)
    if search:
        query = query.where(User.name.ilike(f"%{search}%"))
    query = query.order_by(User.name).limit(limit).offset(offset)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/users", response_model=UserOut)
async def create_user(
    body: UserCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(user)
    new_user = User(
        name=body.name,
        phone=body.phone,
        email=body.email,
        role=body.role,
        pti=body.pti,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


@router.patch("/users/{user_id}/role", response_model=UserOut)
async def update_role(
    user_id: int,
    body: UserRoleUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(user)
    if body.role not in ("admin", "ratking", "rat"):
        raise HTTPException(status_code=400, detail="Invalid role")
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    target.role = body.role
    await db.commit()
    await db.refresh(target)
    return target


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin: delete a user and all their references."""
    _require_admin(user)
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.role == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete an admin user")

    # Clear all foreign key references
    await db.execute(select(GroupMember).where(
        GroupMember.contact_id.in_(select(Contact.id).where(Contact.user_id == user_id))
    ))
    # Delete in order of dependencies
    for model, col in [
        (InviteLink, InviteLink.ratking_id),
        (MagicToken, MagicToken.user_id),
        (Invitation, Invitation.user_id),
        (GroupMember, GroupMember.contact_id),
    ]:
        if model == GroupMember:
            # Delete group members via contacts
            contact_ids = (await db.execute(
                select(Contact.id).where((Contact.user_id == user_id) | (Contact.owner_id == user_id))
            )).scalars().all()
            if contact_ids:
                await db.execute(select(GroupMember).where(GroupMember.contact_id.in_(contact_ids)))
                for gm in (await db.execute(select(GroupMember).where(GroupMember.contact_id.in_(contact_ids)))).scalars().all():
                    await db.delete(gm)
        else:
            for row in (await db.execute(select(model).where(col == user_id))).scalars().all():
                await db.delete(row)

    # Delete contacts (as owner or as target)
    for c in (await db.execute(select(Contact).where((Contact.user_id == user_id) | (Contact.owner_id == user_id)))).scalars().all():
        await db.delete(c)

    # Delete player_teams
    for pt in (await db.execute(select(PlayerTeam).where(PlayerTeam.player_id == user_id))).scalars().all():
        await db.delete(pt)

    # Delete sessions they created
    for s in (await db.execute(select(Session).where(Session.ratking_id == user_id))).scalars().all():
        # Delete invitations for those sessions
        for inv in (await db.execute(select(Invitation).where(Invitation.session_id == s.id))).scalars().all():
            await db.delete(inv)
        await db.delete(s)

    # Finally delete the user
    await db.delete(target)
    await db.commit()
    return {"status": "deleted", "name": target.name, "id": user_id}


class BulkPlayer(BaseModel):
    name: str
    pti: float | None = None


@router.post("/seed-players")
async def seed_players(
    players: list[BulkPlayer],
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin: bulk import players from scraper data."""
    _require_admin(user)
    added = 0
    for p in players:
        result = await db.execute(select(User).where(User.name == p.name))
        if result.scalar_one_or_none():
            continue
        db.add(User(name=p.name, pti=p.pti, role="rat"))
        added += 1
    await db.commit()
    return {"added": added, "skipped": len(players) - added}


class LeagueSeries(BaseModel):
    id: int
    name: str


class LeagueTeam(BaseModel):
    id: int
    name: str
    series_id: int


class LeaguePlayerTeam(BaseModel):
    player_name: str
    team_id: int


class LeagueData(BaseModel):
    series: list[LeagueSeries]
    teams: list[LeagueTeam]
    player_teams: list[LeaguePlayerTeam]


@router.post("/seed-league")
async def seed_league(
    data: LeagueData,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin: seed series, teams, and player-team links."""
    _require_admin(user)

    # Series
    series_added = 0
    for s in data.series:
        result = await db.execute(select(Series).where(Series.name == s.name))
        if not result.scalar_one_or_none():
            db.add(Series(id=s.id, name=s.name))
            series_added += 1
    await db.flush()

    # Teams
    teams_added = 0
    for t in data.teams:
        result = await db.execute(
            select(Team).where(Team.name == t.name, Team.series_id == t.series_id)
        )
        if not result.scalar_one_or_none():
            db.add(Team(id=t.id, name=t.name, series_id=t.series_id))
            teams_added += 1
    await db.flush()

    # Player-team links
    links_added = 0
    for pt in data.player_teams:
        result = await db.execute(select(User).where(User.name == pt.player_name))
        player = result.scalar_one_or_none()
        if not player:
            continue
        result = await db.execute(
            select(PlayerTeam).where(
                PlayerTeam.player_id == player.id,
                PlayerTeam.team_id == pt.team_id,
            )
        )
        if not result.scalar_one_or_none():
            db.add(PlayerTeam(player_id=player.id, team_id=pt.team_id))
            links_added += 1
    await db.commit()

    return {
        "series_added": series_added,
        "teams_added": teams_added,
        "links_added": links_added,
    }
