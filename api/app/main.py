from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import settings
from app.routers import admin, auth, contacts, directory, groups, invite, sessions, share, waitlist, webhooks
from app.services.expiry import check_expired_invitations

scheduler = AsyncIOScheduler()
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(
        check_expired_invitations,
        "interval",
        seconds=settings.expiry_check_interval_seconds,
        id="expiry_checker",
    )
    scheduler.start()
    print(f"[Scheduler] Expiry checker running every {settings.expiry_check_interval_seconds}s")
    yield
    scheduler.shutdown()


app = FastAPI(
    title="PaddleRat API",
    description="Platform tennis coordination",
    version="0.1.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://paddlerat.com",
        "https://www.paddlerat.com",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-User-Id"],
)

app.include_router(auth.router)
app.include_router(sessions.router)
app.include_router(contacts.router)
app.include_router(groups.router)
app.include_router(invite.router)
app.include_router(directory.router)
app.include_router(share.router)
app.include_router(waitlist.router)
app.include_router(webhooks.router)
app.include_router(admin.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
