from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI

from app.config import settings
from app.routers import admin, auth, contacts, groups, sessions, webhooks
from app.services.expiry import check_expired_invitations

scheduler = AsyncIOScheduler()


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
    title="RatKings API",
    description="Platform tennis coordination",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(auth.router)
app.include_router(sessions.router)
app.include_router(contacts.router)
app.include_router(groups.router)
app.include_router(webhooks.router)
app.include_router(admin.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
