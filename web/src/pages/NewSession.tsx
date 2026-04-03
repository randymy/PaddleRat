import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createSession,
  getContacts,
  type Contact,
  type CreateSessionPayload,
} from "../lib/api";

export default function NewSession() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [backups, setBackups] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [location, setLocation] = useState("");
  const [courtNumber, setCourtNumber] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");
  const [slotsNeeded, setSlotsNeeded] = useState(3);
  const [expiryMinutes, setExpiryMinutes] = useState(120);

  useEffect(() => {
    getContacts().then(setContacts);
  }, []);

  function toggleContact(id: number, tier: "primary" | "backup") {
    if (tier === "primary") {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelected(next);
      // Remove from backup if added to primary
      const b = new Set(backups);
      b.delete(id);
      setBackups(b);
    } else {
      const next = new Set(backups);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setBackups(next);
      // Remove from primary if added to backup
      const s = new Set(selected);
      s.delete(id);
      setSelected(s);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!location || !date) {
      setError("Location and date are required");
      return;
    }
    if (selected.size === 0) {
      setError("Select at least one player to invite");
      return;
    }

    setError("");
    setLoading(true);

    const scheduledAt = new Date(`${date}T${time}`).toISOString();
    const payload: CreateSessionPayload = {
      location,
      court_number: courtNumber || undefined,
      scheduled_at: scheduledAt,
      slots_needed: slotsNeeded,
      expires_in_minutes: expiryMinutes,
      invite_user_ids: contacts
        .filter((c) => selected.has(c.id))
        .map((c) => c.user_id),
      backup_user_ids: contacts
        .filter((c) => backups.has(c.id))
        .map((c) => c.user_id),
    };

    try {
      const session = await createSession(payload);
      navigate(`/sessions/${session.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <h1>New Session</h1>

      <form onSubmit={handleSubmit}>
        <label>
          Location
          <input
            type="text"
            placeholder="e.g. Midtown Athletic Club"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />
        </label>

        <label>
          Court Number
          <input
            type="text"
            placeholder="e.g. 3"
            value={courtNumber}
            onChange={(e) => setCourtNumber(e.target.value)}
          />
        </label>

        <div className="row">
          <label>
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label>
            Time
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
        </div>

        <div className="row">
          <label>
            Players Needed
            <select
              value={slotsNeeded}
              onChange={(e) => setSlotsNeeded(Number(e.target.value))}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
          <label>
            Expiry
            <select
              value={expiryMinutes}
              onChange={(e) => setExpiryMinutes(Number(e.target.value))}
            >
              <option value={20}>20 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
              <option value={240}>4 hours</option>
              <option value={480}>8 hours</option>
              <option value={1440}>24 hours</option>
              <option value={2880}>48 hours</option>
            </select>
          </label>
        </div>

        <h3>Invite Players</h3>
        {contacts.length === 0 && (
          <p className="empty">
            No contacts yet. <a href="/contacts">Import some first.</a>
          </p>
        )}

        <div className="contact-list">
          {contacts.map((c) => (
            <div key={c.id} className="contact-row">
              <div className="contact-info">
                <strong>{c.user.name}</strong>
                {c.user.pti && (
                  <span className="pti">PTI {c.user.pti}</span>
                )}
              </div>
              <div className="contact-actions">
                <button
                  type="button"
                  className={`btn-small ${selected.has(c.id) ? "active" : ""}`}
                  onClick={() => toggleContact(c.id, "primary")}
                >
                  {selected.has(c.id) ? "Primary" : "Invite"}
                </button>
                <button
                  type="button"
                  className={`btn-small btn-secondary ${backups.has(c.id) ? "active" : ""}`}
                  onClick={() => toggleContact(c.id, "backup")}
                >
                  Backup
                </button>
              </div>
            </div>
          ))}
        </div>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Sending Invites..." : "Create Session & Send Invites"}
        </button>
      </form>
    </div>
  );
}
