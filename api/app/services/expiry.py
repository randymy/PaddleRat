from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models import Invitation, Session, User
from app.services.sms import sms_client


async def check_expired_invitations():
    """Background job: expire pending invitations, promote tier-2, notify RatKings."""
    async with async_session() as db:
        now = datetime.now(timezone.utc)

        # 1. Find and expire pending invitations past their deadline
        result = await db.execute(
            select(Invitation).where(
                Invitation.status == "pending",
                Invitation.expires_at < now,
            )
        )
        expired = result.scalars().all()

        if not expired:
            return

        affected_sessions: set[int] = set()

        for inv in expired:
            inv.status = "expired"
            affected_sessions.add(inv.session_id)
            user = await db.get(User, inv.user_id)
            ratking_name = (await db.get(User, (await db.get(Session, inv.session_id)).ratking_id)).name
            sms_client.send(
                user.phone,
                f"Invite expired. {ratking_name} will reach out if a spot opens.",
                user_name=user.name,
            )

        await db.flush()

        # 2. For each affected session, check if we need to promote tier-2 or notify
        for session_id in affected_sessions:
            session = await db.get(Session, session_id)
            if session.status != "open":
                continue

            # Check if session time has passed
            if session.scheduled_at < now:
                session.status = "expired"
                ratking = await db.get(User, session.ratking_id)
                scheduled = session.scheduled_at.strftime("%A, %b %-d at %-I:%M %p")
                sms_client.send(
                    ratking.phone,
                    f"Your {scheduled} session at {session.location} has expired with unfilled slots.",
                    user_name=ratking.name,
                )
                continue

            # Count booked slots
            booked_result = await db.execute(
                select(Invitation).where(
                    Invitation.session_id == session_id,
                    Invitation.status == "booked",
                )
            )
            booked_count = len(booked_result.scalars().all())
            slots_remaining = session.slots_needed - booked_count

            if slots_remaining <= 0:
                continue

            # Check for uninvited tier-2 contacts
            tier2_result = await db.execute(
                select(Invitation).where(
                    Invitation.session_id == session_id,
                    Invitation.tier == 2,
                    Invitation.status == "pending",
                )
            )
            # If there are already pending tier-2, they're already invited
            # Look for tier-2 that haven't been created yet — but we create all at session time
            # So instead: if no tier-2 pending, notify the RatKing

            pending_tier2 = tier2_result.scalars().all()
            if not pending_tier2:
                # No backup invites pending — notify RatKing
                ratking = await db.get(User, session.ratking_id)
                scheduled = session.scheduled_at.strftime("%A, %b %-d at %-I:%M %p")
                sms_client.send(
                    ratking.phone,
                    f"You still need {slots_remaining} player{'s' if slots_remaining > 1 else ''} "
                    f"for your {scheduled} court at {session.location}.",
                    user_name=ratking.name,
                )

        await db.commit()
