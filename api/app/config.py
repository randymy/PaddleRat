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
    jwt_secret: str = "change-me-in-production"
    jwt_expiry_hours: int = 72
    magic_link_expiry_minutes: int = 15
    app_url: str = "http://localhost:8000"

    model_config = SettingsConfigDict(env_file=str(_env_file), env_file_encoding="utf-8")


settings = Settings()

# Railway provides postgresql:// but asyncpg needs postgresql+asyncpg://
if settings.database_url.startswith("postgresql://"):
    settings.database_url = settings.database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
