# PaddleRat User Flows

---

## Matchmaker Flow

The Matchmaker is the person who books courts and organizes sessions. They use the web app to manage contacts, create sessions, and track responses.

### 1. Sign Up

1. Visit **paddlerat.com**
2. Scroll to "Become a Matchmaker"
3. Enter name and email
4. Submit — you're on the waitlist
5. Admin receives a notification email
6. Admin approves you at **paddlerat.com/admin**
7. You receive an email: "You've been approved as a Matchmaker on PaddleRat!"
8. Click the login link in the email

### 2. Log In

1. Visit **paddlerat.com/login**
2. Enter your email
3. Check your inbox for the login link
4. Click the link — you're in
5. You land on the Dashboard

### 3. Add Contacts

Before you can invite anyone to play, they need to be in your contacts.

**Option A: Share an invite link (recommended)**

1. Go to **Contacts**
2. Tap **Share Invite Link**
3. A link is generated and copied to your clipboard
4. Paste it in your group text, WhatsApp, or wherever your paddle crew lives
5. Each friend taps the link, finds themselves in the player database, and enters their phone number
6. They automatically appear in your contacts

**Option B: Browse the Chicagoland Directory**

1. Go to **Contacts** → scroll to **Chicagoland Players**
2. Tap **Browse**
3. Search by name
4. Tap **+ Add** next to any player who has opted into the directory

### 4. Create Lists

Lists let you organize contacts into groups for quick invites.

1. Go to **Contacts**
2. Tap **+ New List**
3. Name it (e.g., "Monday Night Crew", "Wilmette Regulars")
4. Tap the list chip to open it
5. Tap **+ Add** to add contacts from your contact list
6. Tap **Remove** to remove someone
7. Tap **Delete List** to delete the entire list

### 5. Create a Session

1. From the Dashboard, tap **New Session**
2. Fill in:
   - **Location** (e.g., "Wilmette Paddle Club")
   - **Court Number** (e.g., "3")
   - **Date and Time**
   - **Players Needed** (1, 2, or 3)
   - **Expiry** (how long invitees have to respond — 20 min to 48 hours)

3. **Invite Group** — select a list
   - The list appears in order
   - Green highlight shows who gets texted immediately (first N = players needed)
   - Everyone below is queued — they get texted automatically if someone declines
   - Hold and drag the handle (☰) to reorder
   - Uncheck anyone sitting this one out

4. **Invite Players** — add individuals not in the selected list

5. Tap **Create Session & Send Invites**
   - SMS goes out immediately to the first N players
   - You're redirected to the session detail page

### 6. Monitor a Session

1. From the Dashboard, tap any session
2. The session detail page shows:
   - Location, court, date/time
   - Status badge (Open, Filled, Expired, Cancelled)
   - Progress bar (e.g., "2/3 confirmed")
   - All invitations grouped by status:
     - **Confirmed** — replied Y and booked
     - **Pending** — SMS sent, waiting for reply
     - **Declined** — replied N
     - **Expired** — didn't reply in time
     - **Waitlisted** — replied Y but session was already full

3. **Remind Pending** — re-sends SMS to everyone who hasn't replied yet
4. **Cancel Session** — cancels the session and expires all pending invitations

### 7. Waterfall Automation

You don't need to do anything — PaddleRat handles it:

- When someone **declines** → the next person on your list automatically gets a text
- When someone's invite **expires** → same thing, next person gets texted
- When all spots are **filled** → everyone gets a confirmation SMS with the lineup and a Google Calendar link
- When the list is **exhausted** and spots remain → you get a text: "You still need 1 player for your Tuesday 7pm court at Wilmette" with a link to invite more

---

## Player Flow

The Player never downloads an app or creates an account. Everything happens via text message and one web page.

### 1. Get Added (One-Time Setup)

1. A Matchmaker sends you a link in a text or group chat
2. Tap the link — opens **paddlerat.com/join/...**
3. You see: "{Matchmaker name} invited you to PaddleRat"
4. Start typing your name — matches from the APTA player database appear
5. Tap your name — your PTI rating confirms it's you
6. Enter your phone number
7. Tap **Join**

**That's it. You're done. You never need to do this again.**

After joining, you'll see:
- A success screen confirming your name and PTI
- An option to **share your info with the Chicagoland community** (opt-in to the player directory so other Matchmakers can find and invite you)
- A link to **become a Matchmaker** yourself if you want to organize sessions

### 2. Receive an Invite

When a Matchmaker creates a session and includes you, you get a text:

> Randy wants to play paddle on Tuesday, Apr 8 at 7:00 PM at Wilmette Paddle Club, Court 3.
>
> Reply Y to join or N to decline.
> (Offer expires in 2 hours)

### 3. Reply

**Reply Y** — you're booked. You'll get a confirmation:
> You're in! Waiting on 1 more player.

Or if you filled the last spot:
> You're in! Session is now full — confirmation sent to all players.

**Reply N** — no worries:
> Got it, thanks! We'll catch you next time.

The next person on the Matchmaker's list automatically gets your spot.

**Don't reply** — your invite expires after the time window. The next person gets texted. You'll receive:
> Invite expired. Randy will reach out if a spot opens.

### 4. Get a Confirmation

When the session is full, everyone receives:

> You're booked!
>
> Randy Myers (PTI 45), Dave Chen (PTI 42), Mia Torres (PTI 38) + you
> are playing on Court 3 at Wilmette Paddle Club.
>
> Tuesday, April 8 at 7:00 PM
>
> Add to Google Calendar:
> https://calendar.google.com/calendar/render?...

Tap the date to add it to your calendar. Show up and play.

---

## Admin Flow

Admins manage who gets access to PaddleRat as a Matchmaker.

### Approve a Matchmaker

1. Go to **paddlerat.com/admin** (must be logged in as admin)
2. See **Pending Requests** — people who signed up on the homepage
3. Tap **Approve** next to someone's name
4. They receive an email with a login link
5. They're now a Matchmaker and can log in, add contacts, and create sessions

---

## Quick Reference

| Action | Where | Who |
|---|---|---|
| Sign up for waitlist | paddlerat.com | Anyone |
| Approve a Matchmaker | paddlerat.com/admin | Admin |
| Log in | paddlerat.com/login | Matchmaker |
| Add contacts | paddlerat.com/contacts | Matchmaker |
| Create a list | paddlerat.com/contacts | Matchmaker |
| Create a session | paddlerat.com/sessions/new | Matchmaker |
| Monitor a session | paddlerat.com/sessions/{id} | Matchmaker |
| Join via invite link | paddlerat.com/join/{code} | Player |
| Reply to invite | SMS | Player |
| Opt into directory | Join success page | Player |
