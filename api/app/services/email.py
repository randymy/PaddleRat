class MockEmailClient:
    """Print-based email client. Replace with SendGrid/SES later."""

    def send(self, to_email: str, subject: str, body: str):
        print(f"[EMAIL -> {to_email}]")
        print(f"  Subject: {subject}")
        print(f"  {body}")
        print()


email_client = MockEmailClient()
