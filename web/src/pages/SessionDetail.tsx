import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getSession,
  cancelSession,
  remindSession,
  type Session,
} from "../lib/api";

const STATUS_COLORS: Record<string, string> = {
  pending: "#FF9800",
  booked: "#4CAF50",
  declined: "#F44336",
  expired: "#9E9E9E",
  waitlisted: "#9C27B0",
};

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    getSession(Number(id)).then(setSession).finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // Poll every 5 seconds for live updates
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [id]);

  async function handleCancel() {
    if (!confirm("Cancel this session? All pending invites will be expired."))
      return;
    const updated = await cancelSession(Number(id));
    setSession(updated);
  }

  async function handleRemind() {
    const updated = await remindSession(Number(id));
    setSession(updated);
  }

  if (loading) return <div className="page"><p>Loading...</p></div>;
  if (!session) return <div className="page"><p>Session not found</p></div>;

  const booked = session.invitations.filter((i) => i.status === "booked");
  const pending = session.invitations.filter((i) => i.status === "pending");
  const declined = session.invitations.filter((i) => i.status === "declined");
  const expired = session.invitations.filter((i) => i.status === "expired");
  const waitlisted = session.invitations.filter((i) => i.status === "waitlisted");

  return (
    <div className="page">
      <button onClick={() => navigate("/")} className="btn-small btn-secondary back-btn">
        &larr; Back
      </button>

      <div className="session-detail-header">
        <h1>{session.location}</h1>
        {session.court_number && <span>Court {session.court_number}</span>}
        <span
          className="status-badge"
          style={{ background: STATUS_COLORS[session.status] || "#666" }}
        >
          {session.status}
        </span>
      </div>

      <p className="session-time">
        {new Date(session.scheduled_at).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </p>

      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{
            width: `${(booked.length / session.slots_needed) * 100}%`,
          }}
        />
        <span>
          {booked.length}/{session.slots_needed} confirmed
        </span>
      </div>

      {session.status === "open" && (
        <div className="session-actions">
          <button onClick={handleRemind} className="btn">
            Remind Pending
          </button>
          <button onClick={handleCancel} className="btn btn-danger">
            Cancel Session
          </button>
        </div>
      )}

      <h2>Invitations</h2>

      {booked.length > 0 && (
        <div className="invite-section">
          <h3>Confirmed</h3>
          {booked.map((inv) => (
            <InviteRow key={inv.id} inv={inv} />
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <div className="invite-section">
          <h3>Pending</h3>
          {pending.map((inv) => (
            <InviteRow key={inv.id} inv={inv} />
          ))}
        </div>
      )}

      {waitlisted.length > 0 && (
        <div className="invite-section">
          <h3>Waitlisted</h3>
          {waitlisted.map((inv) => (
            <InviteRow key={inv.id} inv={inv} />
          ))}
        </div>
      )}

      {declined.length > 0 && (
        <div className="invite-section">
          <h3>Declined</h3>
          {declined.map((inv) => (
            <InviteRow key={inv.id} inv={inv} />
          ))}
        </div>
      )}

      {expired.length > 0 && (
        <div className="invite-section">
          <h3>Expired</h3>
          {expired.map((inv) => (
            <InviteRow key={inv.id} inv={inv} />
          ))}
        </div>
      )}
    </div>
  );
}

function InviteRow({ inv }: { inv: Session["invitations"][0] }) {
  return (
    <div className="invite-row">
      <div className="invite-info">
        <strong>{inv.user.name}</strong>
        {inv.user.pti && <span className="pti">PTI {inv.user.pti}</span>}
      </div>
      <span
        className="status-badge"
        style={{ background: STATUS_COLORS[inv.status] || "#666" }}
      >
        {inv.status}
      </span>
    </div>
  );
}
