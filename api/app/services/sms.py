class MockSMSClient:
    """Print-based SMS client. Drop-in replacement for Twilio later."""

    def send(self, to_phone: str | None, body: str, user_name: str = "Unknown"):
        if to_phone:
            print(f"[SMS -> {to_phone}] {body}")
        else:
            print(f"[SMS -> {user_name} (no phone)] {body}")


sms_client = MockSMSClient()
