# PaddleRat

A coordination app for platform tennis players. You have a court booked — now find 3 more players, fast.

A **RatKing** (session organizer) sends SMS invites to their paddle friends. Players reply **Y** or **N** by text. First to respond get the spot. When the session fills, everyone gets a confirmation with a calendar link. No app install required.

## How It Works

1. **RatKing shares an invite link** in their group chat
2. **Friends tap the link**, find themselves in the player database, and enter their phone number (one-time setup)
3. **RatKing creates a session** — picks a court, date/time, and selects who to invite
4. **Invitees get a text**: *"Randy wants to play paddle on Tuesday at 7pm at Midtown. Reply Y to join or N to decline."*
5. **Players reply Y** — first 3 to respond are booked
6. **Everyone gets a confirmation** with all player names, PTI ratings, and a Google Calendar link

## Architecture

```
PaddleRats/
├── api/          # FastAPI backend (Python)
│   ├── app/
│   │   ├── routers/      # REST endpoints
│   │   ├── services/     # SMS, auth, invitations, expiry
│   │   └── models.py     # SQLAlchemy ORM
│   └── alembic/          # Database migrations
└── web/          # React + TypeScript frontend
    └── src/
        ├── pages/        # Login, Dashboard, Sessions, Contacts, Join
        └── lib/          # API client, auth context
```

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, SQLAlchemy, PostgreSQL |
| Frontend | React, TypeScript, Vite |
| SMS | Twilio |
| Auth | Magic link email + JWT |
| Hosting | Railway |
## Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker (for Postgres)

### Setup

```bash
# Start Postgres
docker compose up -d

# API
cd api
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload

# Frontend (in another terminal)
cd web
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in your Twilio credentials.

### Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SMS_BACKEND` | `mock` (prints to console) or `twilio` (sends real SMS) |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio phone number (e.g. +18475124595) |
| `JWT_SECRET` | Secret key for JWT signing |
| `APP_URL` | Backend URL (e.g. http://localhost:8000) |

## API Endpoints

### Auth
- `POST /auth/login` — Send magic link email
- `GET /auth/verify` — Exchange token for JWT

### Sessions
- `POST /sessions` — Create session + send invites
- `GET /sessions` — List your sessions
- `GET /sessions/{id}` — Session detail with live invitation status
- `PATCH /sessions/{id}/cancel` — Cancel session
- `POST /sessions/{id}/remind` — Re-ping pending invitees

### Contacts
- `GET /contacts` — List your contacts
- `POST /contacts/import` — Bulk import name + phone pairs
- `DELETE /contacts/{id}` — Remove a contact

### Invite (public)
- `POST /invite/link` — Generate shareable invite link
- `GET /invite/search?q=name` — Search player database
- `POST /invite/join` — Self-register via invite link

### SMS Webhook
- `POST /webhooks/sms/inbound` — Twilio posts here on every reply

## License

Private. All rights reserved.
