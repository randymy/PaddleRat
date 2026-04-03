from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models import Invitation, Session, User
from app.schemas import SessionCreate, SessionOut
from app.services import invitation as inv_service

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionOut)
async def create_session(
    body: SessionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role not in ("ratking", "admin"):
        raise HTTPException(status_code=403, detail="Only RatKings can create sessions")

    session = Session(
        ratking_id=user.id,
        location=body.location,
        court_number=body.court_number,
        scheduled_at=body.scheduled_at,
        slots_needed=body.slots_needed,
        expires_in_minutes=body.expires_in_minutes,
        status="open",
    )
    db.add(session)
    await db.flush()

    # Create invitations in waterfall order
    all_user_ids = body.invite_user_ids + body.backup_user_ids
    if all_user_ids:
        await inv_service.create_invitations_waterfall(db, session, all_user_ids)

    await db.commit()

    return await _load_session(db, session.id)


@router.get("", response_model=list[SessionOut])
async def list_sessions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Session)
        .where(Session.ratking_id == user.id)
        .options(selectinload(Session.invitations).selectinload(Invitation.user))
        .order_by(Session.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{session_id}", response_model=SessionOut)
async def get_session(
    session_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _load_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.patch("/{session_id}/cancel", response_model=SessionOut)
async def cancel_session(
    session_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(Session, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.ratking_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not your session")
    if session.status not in ("drafting", "open"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel a {session.status} session")

    session.status = "cancelled"

    # Expire all pending invitations
    result = await db.execute(
        select(Invitation).where(
            Invitation.session_id == session_id,
            Invitation.status == "pending",
        )
    )
    for inv in result.scalars():
        inv.status = "expired"

    await db.commit()
    return await _load_session(db, session_id)


@router.post("/{session_id}/remind", response_model=SessionOut)
async def remind_session(
    session_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(Session, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.ratking_id != user.id:
        raise HTTPException(status_code=403, detail="Not your session")
    if session.status != "open":
        raise HTTPException(status_code=400, detail="Session is not open")

    # Re-send SMS to all pending invitees
    result = await db.execute(
        select(Invitation).where(
            Invitation.session_id == session_id,
            Invitation.status == "pending",
        )
    )
    from app.services.sms import sms_client

    for inv in result.scalars():
        inv_user = await db.get(User, inv.user_id)
        scheduled = session.scheduled_at.strftime("%A, %b %-d at %-I:%M %p")
        sms_client.send(
            inv_user.phone,
            f"Reminder: {user.name} still needs players for {scheduled} at {session.location}. Reply Y to join!",
            user_name=inv_user.name,
        )

    return await _load_session(db, session_id)


async def _load_session(db: AsyncSession, session_id: int) -> Session | None:
    result = await db.execute(
        select(Session)
        .where(Session.id == session_id)
        .options(selectinload(Session.invitations).selectinload(Invitation.user))
    )
    return result.scalar_one_or_none()
