import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createSession,
  getContacts,
  getGroups,
  getGroup,
  type Contact,
  type Group,
  type CreateSessionPayload,
} from "../lib/api";

interface InviteItem {
  userId: number;
  contactId: number;
  name: string;
  pti: number | null;
  enabled: boolean;
}

export default function NewSession() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [inviteList, setInviteList] = useState<InviteItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [individualSelected, setIndividualSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [location, setLocation] = useState("");
  const [courtNumber, setCourtNumber] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");
  const [slotsNeeded, setSlotsNeeded] = useState(3);
  const [expiryMinutes, setExpiryMinutes] = useState(120);

  useEffect(() => {
    Promise.all([getContacts(), getGroups()]).then(([c, g]) => {
      setContacts(c);
      setGroups(g);
    });
  }, []);

  async function handleSelectGroup(groupId: number) {
    setSelectedGroupId(groupId);
    const detail = await getGroup(groupId);
    setInviteList(
      detail.members.map((m) => ({
        userId: m.user_id,
        contactId: m.contact_id,
        name: m.name,
        pti: m.pti,
        enabled: true,
      }))
    );
    setIndividualSelected(new Set());
  }

  function clearGroup() {
    setSelectedGroupId(null);
    setInviteList([]);
  }

  function toggleItem(idx: number) {
    setInviteList((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, enabled: !item.enabled } : item
      )
    );
  }

  function moveItem(idx: number, direction: "up" | "down") {
    setInviteList((prev) => {
      const next = [...prev];
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return next;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  }

  function toggleIndividual(contact: Contact) {
    const next = new Set(individualSelected);
    if (next.has(contact.id)) {
      next.delete(contact.id);
    } else {
      next.add(contact.id);
    }
    setIndividualSelected(next);
  }

  function getOrderedUserIds(): number[] {
    // Group members first (in order, enabled only), then individual selections
    const groupIds = inviteList
      .filter((item) => item.enabled)
      .map((item) => item.userId);

    const individualIds = contacts
      .filter((c) => individualSelected.has(c.id))
      .map((c) => c.user_id)
      .filter((id) => !groupIds.includes(id)); // avoid duplicates

    return [...groupIds, ...individualIds];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!location || !date) {
      setError("Location and date are required");
      return;
    }

    const userIds = getOrderedUserIds();
    if (userIds.length === 0) {
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
      invite_user_ids: userIds,
      backup_user_ids: [],
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

  // Contacts not in the selected group (for individual add)
  const groupUserIds = new Set(inviteList.map((item) => item.userId));

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

        {/* ── Invite Group ──────────────────────── */}
        <h3>Invite Group</h3>

        {groups.length === 0 && (
          <p className="empty">
            No lists yet. <a href="/contacts">Create one first.</a>
          </p>
        )}

        {!selectedGroupId && groups.length > 0 && (
          <div className="list-chips">
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                className="list-chip"
                onClick={() => handleSelectGroup(g.id)}
              >
                {g.name} &rsaquo;
              </button>
            ))}
          </div>
        )}

        {selectedGroupId && (
          <div className="invite-group-detail">
            <div className="section-header">
              <span className="invite-group-label">
                {groups.find((g) => g.id === selectedGroupId)?.name}
              </span>
              <button type="button" className="btn-small btn-secondary" onClick={clearGroup}>
                Change
              </button>
            </div>
            <p className="empty" style={{ margin: "4px 0 8px" }}>
              First {slotsNeeded} get texted. Rest are next in line if someone declines.
              Drag to reorder. Uncheck to skip.
            </p>
            <div className="waterfall-list">
              {inviteList.map((item, idx) => (
                <div
                  key={item.contactId}
                  className={`waterfall-item ${!item.enabled ? "disabled" : ""} ${idx < slotsNeeded && item.enabled ? "active-slot" : ""}`}
                >
                  <div className="waterfall-left">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={() => toggleItem(idx)}
                    />
                    <span className="waterfall-position">
                      {item.enabled
                        ? inviteList.filter((it, i) => i <= idx && it.enabled).length
                        : "–"}
                    </span>
                    <strong>{item.name}</strong>
                    {item.pti && <span className="pti">PTI {item.pti}</span>}
                  </div>
                  <div className="waterfall-arrows">
                    <button type="button" onClick={() => moveItem(idx, "up")} disabled={idx === 0}>
                      &#9650;
                    </button>
                    <button type="button" onClick={() => moveItem(idx, "down")} disabled={idx === inviteList.length - 1}>
                      &#9660;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Invite Individual Players ─────────── */}
        <h3>Invite Players</h3>

        {contacts.length === 0 && (
          <p className="empty">
            No contacts yet. <a href="/contacts">Import some first.</a>
          </p>
        )}

        <div className="contact-list">
          {contacts
            .filter((c) => !groupUserIds.has(c.user_id))
            .map((c) => (
              <div key={c.id} className="contact-row">
                <div className="contact-info">
                  <strong>{c.user.name}</strong>
                  {c.user.pti && <span className="pti">PTI {c.user.pti}</span>}
                </div>
                <button
                  type="button"
                  className={`btn-small ${individualSelected.has(c.id) ? "active" : ""}`}
                  onClick={() => toggleIndividual(c)}
                >
                  {individualSelected.has(c.id) ? "Added" : "Add"}
                </button>
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
