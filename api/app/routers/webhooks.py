from fastapi import APIRouter, Depends, Form, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from twilio.request_validator import RequestValidator

from app.config import settings
from app.dependencies import get_db
from app.models import User
from app.services import invitation as inv_service
from app.services.sms import sms_client
from app.utils import normalize_phone

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


async def validate_twilio_signature(request: Request):
    """Verify the request actually came from Twilio."""
    if not settings.twilio_auth_token:
        return  # Skip validation in dev/mock mode

    validator = RequestValidator(settings.twilio_auth_token)
    signature = request.headers.get("X-Twilio-Signature", "")

    # Reconstruct the full URL Twilio signed
    url = str(request.url)
    # Use the forwarded proto/host if behind a proxy
    forwarded_proto = request.headers.get("X-Forwarded-Proto")
    forwarded_host = request.headers.get("X-Forwarded-Host")
    if forwarded_proto and forwarded_host:
        url = f"{forwarded_proto}://{forwarded_host}{request.url.path}"

    form = await request.form()
    params = dict(form)

    if not validator.validate(url, params, signature):
        raise HTTPException(status_code=403, detail="Invalid Twilio signature")


@router.post("/sms/inbound")
async def sms_inbound(
    request: Request,
    From: str = Form(...),
    Body: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Twilio POSTs here on every inbound SMS.
    Parses Y/N, updates invitation state.
    """
    await validate_twilio_signature(request)

    phone = normalize_phone(From)
    body = Body.strip()

    # Look up user by phone
    result = await db.execute(select(User).where(User.phone == phone))
    user = result.scalar_one_or_none()

    if not user:
        sms_client.send(phone, "Sorry, we don't recognize this number. Ask the person who invited you to add you on PaddleRat.")
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
