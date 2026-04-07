from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models import Contact, User
from app.schemas import ContactCreate, ContactImportRequest, ContactImportResult, ContactOut
from app.utils import normalize_phone

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


@router.post("/import", response_model=ContactImportResult)
async def import_contacts(
    body: ContactImportRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    created_contacts = []
    skipped = 0

    for item in body.contacts:
        phone = normalize_phone(item.phone)

        # 1. Check if a user with this phone already exists
        result = await db.execute(select(User).where(User.phone == phone))
        target = result.scalar_one_or_none()

        if not target:
            # 2. Check if a user with this name exists but has no phone (APTA scraper data)
            result = await db.execute(
                select(User).where(User.name == item.name, User.phone.is_(None)).limit(1)
            )
            target = result.scalar_one_or_none()

            if target:
                # Link phone to existing APTA player — they get their PTI for free
                target.phone = phone
            else:
                # 3. Create a new user
                target = User(name=item.name, phone=phone, role="rat")
                db.add(target)

            await db.flush()

        # 4. Create contact link (skip if already exists)
        result = await db.execute(
            select(Contact).where(
                Contact.owner_id == user.id, Contact.user_id == target.id
            )
        )
        if result.scalar_one_or_none():
            skipped += 1
            continue

        contact = Contact(owner_id=user.id, user_id=target.id, nickname=item.name)
        db.add(contact)
        await db.flush()
        created_contacts.append(contact)

    await db.commit()

    # Reload contacts with user data
    loaded = []
    for c in created_contacts:
        result = await db.execute(
            select(Contact).where(Contact.id == c.id).options(selectinload(Contact.user))
        )
        loaded.append(result.scalar_one())

    return ContactImportResult(
        imported=len(created_contacts),
        skipped=skipped,
        contacts=loaded,
    )


class CreatePlayerRequest(BaseModel):
    name: str
    phone: str | None = None
    pti: float | None = None


@router.post("/create-player", response_model=ContactOut)
async def create_player(
    body: CreatePlayerRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new player and add them as a contact."""
    phone = normalize_phone(body.phone) if body.phone else None

    # Check if phone already exists
    if phone:
        result = await db.execute(select(User).where(User.phone == phone))
        existing = result.scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=400, detail=f"Phone already registered to {existing.name}")

    # Create the user
    new_user = User(name=body.name, phone=phone, pti=body.pti, role="rat", invited_by_id=user.id)
    db.add(new_user)
    await db.flush()

    # Create the contact link
    contact = Contact(owner_id=user.id, user_id=new_user.id, nickname=body.name)
    db.add(contact)
    await db.commit()

    result = await db.execute(
        select(Contact).where(Contact.id == contact.id).options(selectinload(Contact.user))
    )
    return result.scalar_one()


class UpdatePtiRequest(BaseModel):
    pti: float


@router.patch("/{contact_id}/pti", response_model=ContactOut)
async def update_pti(
    contact_id: int,
    body: UpdatePtiRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update PTI for a contact's user."""
    contact = await db.get(Contact, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    if contact.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your contact")

    target = await db.get(User, contact.user_id)
    target.pti = body.pti
    await db.commit()

    result = await db.execute(
        select(Contact).where(Contact.id == contact_id).options(selectinload(Contact.user))
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
