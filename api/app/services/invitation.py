from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Invitation, Session, User
from app.services.calendar import build_google_calendar_link
from app.services.sms import sms_client


async def create_invitations_waterfall(
    db: AsyncSession,
    session: Session,
    user_ids: list[int],
) -> list[Invitation]:
    """
    Create invitations in waterfall order.
    First `slots_needed` get status='pending' and receive SMS.
    The rest get status='queued' and wait their turn.
    """
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=session.expires_in_minutes)

    invitations = []
    for position, uid in enumerate(user_ids):
        is_active = position < session.slots_needed
        inv = Invitation(
            session_id=session.id,
            user_id=uid,
            tier=1,
            position=position,
            status="pending" if is_active else "queued",
            invited_at=now if is_active else None,
            expires_at=expires_at if is_active else now,  # queued gets a placeholder
        )
        db.add(inv)
        invitations.append(inv)

    await db.flush()

    # Send SMS only to the active (pending) invitations
    active = [inv for inv in invitations if inv.status == "pending"]
    await _send_invite_sms(db, session, active)

    return invitations


async def promote_next_queued(db: AsyncSession, session: Session):
    """Promote the next queued invitation to pending and send SMS."""
    booked_count = await _count_booked(db, session.id)
    pending_count = await _count_status(db, session.id, "pending")
    slots_open = session.slots_needed - booked_count - pending_count

    if slots_open <= 0:
        return

    # Get next queued invitations in position order
    result = await db.execute(
        select(Invitation)
        .where(
            Invitation.session_id == session.id,
            Invitation.status == "queued",
        )
        .order_by(Invitation.position)
        .limit(slots_open)
    )
    queued = result.scalars().all()

    if queued:
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=session.expires_in_minutes)
        for inv in queued:
            inv.status = "pending"
            inv.invited_at = now
            inv.expires_at = expires_at
        await db.flush()
        await _send_invite_sms(db, session, queued)
    else:
        # No more queued — notify the RatKing
        remaining = session.slots_needed - booked_count
        if remaining > 0:
            await _notify_ratking_need_players(db, session, remaining)


async def handle_response(
    db: AsyncSession,
    user: User,
    response: str,
) -> dict:
    """Process a Y/N SMS reply."""
    result = await db.execute(
        select(Invitation)
        .where(Invitation.user_id == user.id, Invitation.status == "pending")
        .order_by(Invitation.invited_at.desc())
        .limit(1)
    )
    inv = result.scalar_one_or_none()

    if not inv:
        return {"action": "no_pending", "reply": "No open invitations found for you."}

    session = await db.get(Session, inv.session_id)
    now = datetime.now(timezone.utc)
    inv.responded_at = now

    if response.upper().startswith("N"):
        inv.status = "declined"
        await db.flush()
        # Promote next person in the waterfall
        await promote_next_queued(db, session)
        return {"action": "declined", "reply": "Got it, thanks! We'll catch you next time."}

    # Y response — check available slots
    booked_count = await _count_booked(db, session.id)

    if booked_count < session.slots_needed:
        inv.status = "booked"
        await db.flush()

        new_booked_count = booked_count + 1
        if new_booked_count >= session.slots_needed:
            session.status = "filled"
            # Cancel remaining pending and queued
            await _cancel_remaining(db, session.id)
            await db.flush()
            await _send_confirmations(db, session)
            return {"action": "booked_and_filled", "reply": "You're in! Session is now full — confirmation sent to all players."}

        remaining = session.slots_needed - new_booked_count
        return {"action": "booked", "reply": f"You're in! Waiting on {remaining} more player{'s' if remaining > 1 else ''}."}

    inv.status = "waitlisted"
    await db.flush()
    return {"action": "waitlisted", "reply": "Sorry, that session is already full. You'll be first on the list next time!"}


# ── Helpers ──────────────────────────────────────────────

async def _count_booked(db: AsyncSession, session_id: int) -> int:
    result = await db.execute(
        select(func.count()).select_from(Invitation)
        .where(Invitation.session_id == session_id, Invitation.status == "booked")
    )
    return result.scalar_one()


async def _count_status(db: AsyncSession, session_id: int, status: str) -> int:
    result = await db.execute(
        select(func.count()).select_from(Invitation)
        .where(Invitation.session_id == session_id, Invitation.status == status)
    )
    return result.scalar_one()


async def _cancel_remaining(db: AsyncSession, session_id: int):
    """Cancel all pending and queued invitations for a filled session."""
    result = await db.execute(
        select(Invitation).where(
            Invitation.session_id == session_id,
            Invitation.status.in_(["pending", "queued"]),
        )
    )
    for inv in result.scalars():
        inv.status = "cancelled"


async def _send_invite_sms(db: AsyncSession, session: Session, invitations: list[Invitation]):
    """Send invite SMS to a list of invitations."""
    ratking = await db.get(User, session.ratking_id)
    for inv in invitations:
        user = await db.get(User, inv.user_id)
        scheduled = session.scheduled_at.strftime("%A, %b %-d at %-I:%M %p")
        body = (
            f"{ratking.name} wants to play paddle on {scheduled} "
            f"at {session.location}"
        )
        if session.court_number:
            body += f", Court {session.court_number}"
        body += f".\n\nReply Y to join or N to decline."
        if session.expires_in_minutes >= 60:
            body += f"\n(Offer expires in {session.expires_in_minutes // 60} hour{'s' if session.expires_in_minutes >= 120 else ''})"
        else:
            body += f"\n(Offer expires in {session.expires_in_minutes} minutes)"
        sms_client.send(user.phone, body, user_name=user.name)


async def _notify_ratking_need_players(db: AsyncSession, session: Session, remaining: int):
    """Text the RatKing that they still need players, with a link to the session."""
    ratking = await db.get(User, session.ratking_id)
    scheduled = session.scheduled_at.strftime("%A, %b %-d at %-I:%M %p")
    body = (
        f"You still need {remaining} player{'s' if remaining > 1 else ''} "
        f"for your {scheduled} court at {session.location}."
        f"\n\nInvite more: {settings.app_url}/sessions/{session.id}"
    )
    sms_client.send(ratking.phone, body, user_name=ratking.name)


async def _send_confirmations(db: AsyncSession, session: Session):
    """Send booking confirmation SMS to all booked players + the RatKing."""
    result = await db.execute(
        select(Invitation)
        .where(Invitation.session_id == session.id, Invitation.status == "booked")
    )
    booked_invs = result.scalars().all()

    ratking = await db.get(User, session.ratking_id)
    all_players = [ratking]
    for inv in booked_invs:
        user = await db.get(User, inv.user_id)
        all_players.append(user)

    player_names = [f"{p.name} (PTI {p.pti})" if p.pti else p.name for p in all_players]
    scheduled = session.scheduled_at.strftime("%A, %B %-d at %-I:%M %p")
    cal_link = build_google_calendar_link(
        location=session.location,
        court_number=session.court_number,
        scheduled_at=session.scheduled_at,
        player_names=[p.name for p in all_players],
    )

    for player in all_players:
        others = [n for n in player_names if n != (f"{player.name} (PTI {player.pti})" if player.pti else player.name)]
        body = (
            f"You're booked!\n\n"
            f"{', '.join(others)} + you\n"
            f"are playing"
        )
        if session.court_number:
            body += f" on Court {session.court_number}"
        body += f" at {session.location}.\n\n"
        body += f"{scheduled}\n\n"
        body += f"Add to Google Calendar:\n{cal_link}"

        sms_client.send(player.phone, body, user_name=player.name)
