from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models import Contact, Group, GroupMember, User
from app.schemas import GroupCreate, GroupMemberAdd, GroupOut

router = APIRouter(prefix="/groups", tags=["groups"])


@router.get("", response_model=list[GroupOut])
async def list_groups(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Group).where(Group.owner_id == user.id).order_by(Group.name)
    )
    return result.scalars().all()


@router.post("", response_model=GroupOut)
async def create_group(
    body: GroupCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = Group(owner_id=user.id, name=body.name)
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return group


@router.delete("/{group_id}", status_code=204)
async def delete_group(
    group_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your group")
    await db.delete(group)
    await db.commit()


@router.post("/{group_id}/members", status_code=201)
async def add_member(
    group_id: int,
    body: GroupMemberAdd,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your group")

    contact = await db.get(Contact, body.contact_id)
    if not contact or contact.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Contact not found")

    member = GroupMember(group_id=group_id, contact_id=body.contact_id)
    db.add(member)
    await db.commit()
    return {"status": "added"}


@router.delete("/{group_id}/members/{contact_id}", status_code=204)
async def remove_member(
    group_id: int,
    contact_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await db.get(Group, group_id)
    if not group or group.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your group")

    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.contact_id == contact_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    await db.delete(member)
    await db.commit()
