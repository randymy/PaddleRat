import re

from fastapi import APIRouter, Depends, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.models import User
from app.services import invitation as inv_service
from app.services.sms import sms_client

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def normalize_phone(phone: str) -> str:
    """Strip to digits, ensure +1 prefix for US numbers."""
    digits = re.sub(r"[^\d]", "", phone)
    if len(digits) == 10:
        digits = "1" + digits
    return f"+{digits}"


@router.post("/sms/inbound")
async def sms_inbound(
    From: str = Form(...),
    Body: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Twilio POSTs here on every inbound SMS.
    Parses Y/N, updates invitation state, captures phone number.
    """
    phone = normalize_phone(From)
    body = Body.strip()

    # Look up user by phone
    result = await db.execute(select(User).where(User.phone == phone))
    user = result.scalar_one_or_none()

    if not user:
        # Unknown number — can't match to a user
        sms_client.send(phone, "Sorry, we don't recognize this number. Ask your RatKing to add you!")
        return {"status": "unknown_user"}

    # Parse response
    first_char = body[0].upper() if body else ""
    if first_char not in ("Y", "N"):
        sms_client.send(phone, "Reply Y to join or N to decline.", user_name=user.name)
        return {"status": "invalid_response"}

    result = await inv_service.handle_response(db, user, first_char)
    await db.commit()

    sms_client.send(phone, result["reply"], user_name=user.name)
    return {"status": result["action"]}
