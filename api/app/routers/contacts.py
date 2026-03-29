from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models import Contact, User
from app.schemas import ContactCreate, ContactOut

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=list[ContactOut])
async def list_contacts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Contact)
        .where(Contact.owner_id == user.id)
        .options(selectinload(Contact.user))
        .order_by(Contact.priority.desc(), Contact.id)
    )
    return result.scalars().all()


@router.post("", response_model=ContactOut)
async def create_contact(
    body: ContactCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify target user exists
    target = await db.get(User, body.user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    contact = Contact(
        owner_id=user.id,
        user_id=body.user_id,
        nickname=body.nickname,
        priority=body.priority,
    )
    db.add(contact)
    await db.commit()

    result = await db.execute(
        select(Contact)
        .where(Contact.id == contact.id)
        .options(selectinload(Contact.user))
    )
    return result.scalar_one()


@router.delete("/{contact_id}", status_code=204)
async def delete_contact(
    contact_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contact = await db.get(Contact, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    if contact.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your contact")
    await db.delete(contact)
    await db.commit()
