import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models import Contact, Group, GroupMember, SharedList, User

router = APIRouter(prefix="/share", tags=["share"])


class ShareListResponse(BaseModel):
    code: str
    link: str
    list_name: str
    player_count: int


class SharedListInfo(BaseModel):
    list_name: str
    owner_name: str
    players: list[dict]


class ImportResult(BaseModel):
    imported: int
    skipped: int


@router.post("/list/{group_id}", response_model=ShareListResponse)
async def share_list(
    group_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a shareable link for a contact list."""
    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="List not found")
    if group.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your list")

    # Get member user IDs
    result = await db.execute(
        select(GroupMember)
        .where(GroupMember.group_id == group_id)
        .options(selectinload(GroupMember.contact))
    )
    members = result.scalars().all()
    user_ids = [str(m.contact.user_id) for m in members]

    if not user_ids:
        raise HTTPException(status_code=400, detail="List is empty")

    code = secrets.token_urlsafe(10)
    shared = SharedList(
        code=code,
        owner_id=user.id,
        group_id=group_id,
        list_name=group.name,
        user_ids=",".join(user_ids),
    )
    db.add(shared)
    await db.commit()

    return ShareListResponse(
        code=code,
        link=f"/import/{code}",
        list_name=group.name,
        player_count=len(user_ids),
    )


@router.post("/contacts", response_model=ShareListResponse)
async def share_all_contacts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a shareable link for all contacts."""
    result = await db.execute(
        select(Contact).where(Contact.owner_id == user.id)
    )
    contacts = result.scalars().all()
    user_ids = [str(c.user_id) for c in contacts]

    if not user_ids:
        raise HTTPException(status_code=400, detail="No contacts to share")

    code = secrets.token_urlsafe(10)
    shared = SharedList(
        code=code,
        owner_id=user.id,
        list_name=f"{user.name}'s Contacts",
        user_ids=",".join(user_ids),
    )
    db.add(shared)
    await db.commit()

    return ShareListResponse(
        code=code,
        link=f"/import/{code}",
        list_name=f"{user.name}'s Contacts",
        player_count=len(user_ids),
    )


@router.get("/info/{code}", response_model=SharedListInfo)
async def get_shared_list_info(
    code: str,
    db: AsyncSession = Depends(get_db),
):
    """Public: get info about a shared list."""
    result = await db.execute(select(SharedList).where(SharedList.code == code))
    shared = result.scalar_one_or_none()
    if not shared:
        raise HTTPException(status_code=404, detail="Shared list not found")

    owner = await db.get(User, shared.owner_id)
    user_ids = [int(uid) for uid in shared.user_ids.split(",") if uid]

    players = []
    for uid in user_ids:
        u = await db.get(User, uid)
        if u:
            players.append({"id": u.id, "name": u.name, "pti": u.pti})

    return SharedListInfo(
        list_name=shared.list_name,
        owner_name=owner.name if owner else "Unknown",
        players=players,
    )


@router.post("/import/{code}", response_model=ImportResult)
async def import_shared_list(
    code: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import a shared list into your contacts."""
    result = await db.execute(select(SharedList).where(SharedList.code == code))
    shared = result.scalar_one_or_none()
    if not shared:
        raise HTTPException(status_code=404, detail="Shared list not found")

    user_ids = [int(uid) for uid in shared.user_ids.split(",") if uid]

    imported = 0
    skipped = 0
    for uid in user_ids:
        # Skip self
        if uid == user.id:
            skipped += 1
            continue

        # Check if already a contact
        result = await db.execute(
            select(Contact).where(Contact.owner_id == user.id, Contact.user_id == uid)
        )
        if result.scalar_one_or_none():
            skipped += 1
            continue

        target = await db.get(User, uid)
        if not target:
            skipped += 1
            continue

        contact = Contact(owner_id=user.id, user_id=uid, nickname=target.name)
        db.add(contact)
        imported += 1

    await db.commit()
    return ImportResult(imported=imported, skipped=skipped)
