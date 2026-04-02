from app.config import settings


class MockSMSClient:
    """Print-based SMS client for development."""

    def send(self, to_phone: str | None, body: str, user_name: str = "Unknown"):
        if to_phone:
            print(f"[SMS -> {to_phone}] {body}")
        else:
            print(f"[SMS -> {user_name} (no phone)] {body}")


class TwilioSMSClient:
    """Real Twilio SMS client. Same interface as MockSMSClient."""

    def __init__(self, account_sid: str, auth_token: str, from_number: str):
        from twilio.rest import Client

        self.client = Client(account_sid, auth_token)
        self.from_number = from_number

    def send(self, to_phone: str | None, body: str, user_name: str = "Unknown"):
        if not to_phone:
            print(f"[SMS SKIPPED -> {user_name} (no phone)] {body}")
            return
        self.client.messages.create(
            body=body,
            from_=self.from_number,
            to=to_phone,
        )
        print(f"[SMS SENT -> {to_phone}] {body[:60]}...")


if settings.sms_backend == "twilio":
    sms_client = TwilioSMSClient(
        settings.twilio_account_sid,
        settings.twilio_auth_token,
        settings.twilio_phone_number,
    )
else:
    sms_client = MockSMSClient()
