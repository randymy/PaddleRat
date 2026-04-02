from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# .env lives at the repo root (one level above api/)
_env_file = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://ratkings:ratkings@localhost:5433/ratkings"
    sms_backend: str = "mock"  # "mock" or "twilio"
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""
    expiry_check_interval_seconds: int = 60

    model_config = SettingsConfigDict(env_file=str(_env_file), env_file_encoding="utf-8")


settings = Settings()
