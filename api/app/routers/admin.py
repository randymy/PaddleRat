from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models import User
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
