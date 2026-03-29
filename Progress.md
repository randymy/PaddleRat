# PaddleRat / RatKings — Progress & Notes

> Last updated: 2026-03-29

---

## What's Built

### Scraper (complete)
- Playwright + SQLite scraper for aptachicago.tenniscores.com
- 6,376 clean player records with name + PTI rating
- 538 teams across 80 divisions (Chicago league)
- Data lives in `data/apta.db`, seeded into Postgres `users` table

### API (Steps 1–4 of PRD Build Order)
- **DB schema** — 6 tables: users, contacts, groups, group_members, sessions, invitations
- **Alembic migrations** — initial schema applied
- **Session + Invitation CRUD** — create, list, get, cancel, remind
- **Invitation state machine** — Y/N response handling, slot filling, waitlist logic
- **Expiry background job** — APScheduler runs every 60s, expires pending invites, notifies RatKing
- **Calendar link builder** — Google Calendar URL generation for booking confirmations
- **SMS webhook endpoint** — `POST /webhooks/sms/inbound` parses Twilio format (From + Body)
- **Contacts + Groups CRUD** — full contact management with group membership
- **Admin endpoints** — user search, create, role management
- **Mock SMS** — all SMS sends go to `print()` for now
- **Seed script** — loads scraper data into Postgres (`python -m app.scripts.seed_users`)

### Infrastructure
- Docker Compose for Postgres 16 (port 5433, since 5432 was occupied locally)
- Python venv in `api/.venv/`
- GitHub repo: https://github.com/randymy/PaddleRat

---

## Next Steps

### Step 5: Twilio Outbound SMS
- Sign up for Twilio, get a phone number
- Replace `MockSMSClient` in `api/app/services/sms.py` with real Twilio client
- Same interface: `send(to_phone, body, user_name)` — no business logic changes needed
- Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` to `.env`

### Step 6: Twilio Inbound Webhook (wiring)
- The endpoint exists (`POST /webhooks/sms/inbound`) and the state machine works
- Need to: configure Twilio webhook URL, handle Twilio signature validation
- Need to: set up ngrok or a public URL for local dev testing
- Phone number capture flow: RatKing imports contacts with phone numbers, system sends invite, reply captures the number permanently

### Step 7: Auth (Magic Link)
- RatKings need to log in to use the web app
- Replace the `X-User-Id` header stub in `api/app/dependencies.py` with real auth
- Magic link flow: enter email → receive link → click → JWT session
- Rats never log in (SMS only)

### Step 8–9: React Frontend
- `web/` directory, React + TypeScript
- Session creation form (location, court, date/time, expiry, select contacts/groups)
- Live session status dashboard (real-time pending/booked/declined)
- Contact + group management UI
- Browser Contacts API for frictionless contact import

### Step 10: Group SMS Thread
- Collaborator is implementing Twilio MMS integration
- Placeholder webhook exists in architecture

### Backlog
- Conflict detection (prevent double-booking a player at overlapping times)
- SMS opt-in compliance line
- Onboarding SMS for new Rats (when a RatKing adds a new phone number)
- PTI auto-sync (re-run scraper periodically, update Postgres users)

---

## Decisions Made

| Decision | Choice | Reasoning |
|---|---|---|
| Database | PostgreSQL (Docker) | Relational integrity for sessions/invites, PRD requirement |
| Auth | Magic link (planned) | Simpler than SIWE for MVP, can swap later |
| PTI source | Scraper DB | Seeded from `data/apta.db`, not manually entered |
| SMS | Mock for now | Build flow first, plug in Twilio when ready |
| Port | 5433 | Local Postgres already on 5432 |
| Phone numbers | Nullable, captured via SMS | Users seeded without phones; numbers captured when they reply to first invite |

---

## Lessons Learned (for Claude Code)

### Site scraping
- **tenniscores.com uses obfuscated URL params** (`?mod=nndz-...&did=nndz-...`), not clean REST paths. The original scraper looked for keywords like "series" and "division" in URLs — none existed. Had to inspect the actual DOM classes (`div_list_option`, `div_list_teams_option`) to find navigation elements.
- **The site blocks requests without a realistic User-Agent.** The browser setup in `scraper/src/utils/browser.js` with Chrome UA + viewport is required. Bare Playwright requests get a "Forbidden" response.
- **Roster table structure**: team pages have multiple tables. The roster table is identified by having `R`, `W`, `L` headers (not `Pts`/`Wks` which is the standings table). Player names are prefixed with `✔` (active) and suffixed with `(C)` (captain) — these need to be stripped.
- **Dirty data in scraper**: ~534 records in `players` table have the entire team roster blob as the `name` field (from first table cell containing the full roster). Filter with `WHERE pti IS NOT NULL AND length(name) < 100`.

### Node.js / npm
- **better-sqlite3 + Node v25**: The `^9.4.3` version doesn't compile on Node 25 (requires C++20). Had to bump to `^12.8.0`.
- **ESM + await in .then()**: The `init.js` file had `await import('fs')` inside a `.then()` callback that wasn't `async`. `await` is only valid in async functions — use top-level imports instead.

### Python / FastAPI project setup
- **setuptools package discovery**: Having both `app/` and `alembic/` directories at the same level causes setuptools to fail with "Multiple top-level packages discovered in flat-layout". Fix: add `[tool.setuptools.packages.find] include = ["app*"]` to `pyproject.toml`.
- **setuptools build backend**: Use `"setuptools.build_meta"`, not `"setuptools.backends._legacy:_Backend"` — the latter doesn't exist.
- **Alembic + async**: The `alembic/env.py` must use `async_engine_from_config` and run migrations through `asyncio.run()`. Standard synchronous Alembic config won't work with `asyncpg`.

### Infrastructure
- **Port conflicts**: Always check if default ports (5432 for Postgres) are already in use before configuring Docker Compose. Use a non-standard port (5433) and update all connection strings: `.env`, `.env.example`, `alembic.ini`, and the config.py default.
- **GitHub push**: HTTPS git auth may not work if no credential helper is configured. SSH (`git@github.com:...`) is more reliable when SSH keys are already set up.

### Project structure
- **Monorepo works here**: Scraper (Node.js) and API (Python) coexist cleanly in `scraper/` and `api/` with separate dependency management. The `data/` directory is the shared bridge.
- **Moving src/ to scraper/src/**: Broke the relative path in `init.js` (`../../data` → `../../../data`). Always check `__dirname`-relative paths after moving files.
