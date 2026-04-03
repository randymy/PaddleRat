from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models import Invitation, Session, User
from app.services.invitation import promote_next_queued
from app.services.sms import sms_client


async def check_expired_invitations():
    """Background job: expire pending invitations, promote next in waterfall."""
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

        # 2. For each affected session, promote next queued or notify RatKing
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

            # Promote next queued invitations (or notify RatKing if none left)
            await promote_next_queued(db, session)

        await db.commit()
