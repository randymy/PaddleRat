"""
Seed the Postgres users table from the scraper's SQLite database.

Usage (from the api/ directory):
    python -m app.scripts.seed_users
"""

import asyncio
import sqlite3
from pathlib import Path

from sqlalchemy import func, select, text

from app.database import async_session, engine
from app.models import Base, User

SCRAPER_DB = Path(__file__).resolve().parents[3] / "data" / "apta.db"


async def seed():
    if not SCRAPER_DB.exists():
        print(f"Error: scraper DB not found at {SCRAPER_DB}")
        return

    # Read clean players from SQLite
    conn = sqlite3.connect(SCRAPER_DB)
    rows = conn.execute(
        "SELECT name, pti FROM players WHERE pti IS NOT NULL AND length(name) < 100"
    ).fetchall()
    conn.close()

    print(f"Read {len(rows)} players from {SCRAPER_DB}")

    async with async_session() as db:
        # Check current count
        result = await db.execute(select(func.count()).select_from(User))
        existing = result.scalar_one()

        if existing > 0:
            print(f"Users table already has {existing} rows. Skipping seed.")
            print("To re-seed, truncate the users table first.")
            return

        # Bulk insert
        users = [User(name=name, pti=pti, role="rat") for name, pti in rows]
        db.add_all(users)
        await db.commit()

        result = await db.execute(select(func.count()).select_from(User))
        final = result.scalar_one()
        print(f"Seeded {final} users into Postgres")


if __name__ == "__main__":
    asyncio.run(seed())
