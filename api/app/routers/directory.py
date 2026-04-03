from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models import Contact, User

router = APIRouter(prefix="/directory", tags=["directory"])


class DirectoryPlayer(BaseModel):
    id: int
    name: str
    pti: float | None

    model_config = {"from_attributes": True}


class DirectoryResponse(BaseModel):
    players: list[DirectoryPlayer]
    total: int


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

    # Total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Results
    result = await db.execute(
        query.order_by(User.name).limit(limit).offset(offset)
    )
    players = result.scalars().all()

    return DirectoryResponse(players=players, total=total)


@router.post("/add/{user_id}")
async def add_from_directory(
    user_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a directory player to your contacts."""
    target = await db.get(User, user_id)
    if not target or not target.phone_public:
        raise HTTPException(status_code=404, detail="Player not found in directory")

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
    return {"status": "added"}
