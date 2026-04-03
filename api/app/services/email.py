from app.config import settings


class MockEmailClient:
    """Print-based email client for development."""

    def send(self, to_email: str, subject: str, body: str):
        print(f"[EMAIL -> {to_email}]")
        print(f"  Subject: {subject}")
        print(f"  {body}")
        print()


class ResendEmailClient:
    """Real email client using Resend."""

    def __init__(self, api_key: str, from_email: str):
        import resend
        resend.api_key = api_key
        self.from_email = from_email

    def send(self, to_email: str, subject: str, body: str):
        import resend
        resend.Emails.send({
            "from": self.from_email,
            "to": [to_email],
            "subject": subject,
            "text": body,
        })
        print(f"[EMAIL SENT -> {to_email}] {subject}")


if settings.resend_api_key:
    email_client = ResendEmailClient(
        settings.resend_api_key,
        settings.from_email,
    )
else:
    email_client = MockEmailClient()
