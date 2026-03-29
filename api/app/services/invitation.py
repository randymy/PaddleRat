from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Invitation, Session, User
from app.services.calendar import build_google_calendar_link
from app.services.sms import sms_client


async def create_invitations(
    db: AsyncSession,
    session: Session,
    user_ids: list[int],
    tier: int = 1,
) -> list[Invitation]:
    """Create invitation rows and send SMS to each invitee."""
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=session.expires_in_minutes)

    invitations = []
    for uid in user_ids:
        inv = Invitation(
            session_id=session.id,
            user_id=uid,
            tier=tier,
            status="pending",
            invited_at=now,
            expires_at=expires_at,
        )
        db.add(inv)
        invitations.append(inv)

    await db.flush()

    # Send invite SMS to each
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
        body += f".\n\nReply Y to join or N to decline.\n(Offer expires in {session.expires_in_minutes // 60} hours)"
        sms_client.send(user.phone, body, user_name=user.name)

    return invitations


async def handle_response(
    db: AsyncSession,
    user: User,
    response: str,
) -> dict:
    """
    Process a Y/N SMS reply. Returns a dict with action taken and SMS reply body.
    """
    # Find the user's most recent pending invitation
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
        return {"action": "declined", "reply": "Got it, thanks! We'll catch you next time."}

    # Y response — check available slots
    booked_count = await _count_booked(db, session.id)

    if booked_count < session.slots_needed:
        inv.status = "booked"
        await db.flush()

        new_booked_count = booked_count + 1
        if new_booked_count >= session.slots_needed:
            # Session is filled!
            session.status = "filled"
            await db.flush()
            await _send_confirmations(db, session)
            return {"action": "booked_and_filled", "reply": "You're in! Session is now full — confirmation sent to all players."}

        remaining = session.slots_needed - new_booked_count
        return {"action": "booked", "reply": f"You're in! Waiting on {remaining} more player{'s' if remaining > 1 else ''}."}

    # Session already full
    inv.status = "waitlisted"
    await db.flush()
    return {"action": "waitlisted", "reply": "Sorry, that session is already full. You'll be first on the list next time!"}


async def _count_booked(db: AsyncSession, session_id: int) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(Invitation)
        .where(Invitation.session_id == session_id, Invitation.status == "booked")
    )
    return result.scalar_one()


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
            f"🎾 You're booked!\n\n"
            f"{', '.join(others)} + you\n"
            f"are playing"
        )
        if session.court_number:
            body += f" on Court {session.court_number}"
        body += f" at {session.location}.\n\n"
        body += f"📅 {scheduled}\n\n"
        body += f"Add to Google Calendar:\n{cal_link}"

        sms_client.send(player.phone, body, user_name=player.name)
