import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSessions, type Session } from "../lib/api";
import { useAuth } from "../lib/auth";

const STATUS_COLORS: Record<string, string> = {
  open: "#2196F3",
  filled: "#4CAF50",
  expired: "#9E9E9E",
  cancelled: "#F44336",
  drafting: "#FF9800",
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSessions().then(setSessions).finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <header className="header">
        <h1>PaddleRats</h1>
        <div className="header-right">
          <span>{user?.name}</span>
          <button onClick={logout} className="btn-small">Logout</button>
        </div>
      </header>

      <nav className="nav">
        <Link to="/sessions/new" className="btn">New Session</Link>
        <Link to="/contacts" className="btn btn-secondary">Contacts</Link>
        {user?.role === "admin" && (
          <Link to="/admin" className="btn btn-secondary">Admin</Link>
        )}
      </nav>

      <h2>Your Sessions</h2>

      {loading && <p>Loading...</p>}

      {!loading && sessions.length === 0 && (
        <p className="empty">No sessions yet. Create one to get started.</p>
      )}

      <div className="session-list">
        {sessions.map((s) => (
          <Link to={`/sessions/${s.id}`} key={s.id} className="session-card">
            <div className="session-card-header">
              <span
                className="status-badge"
                style={{ background: STATUS_COLORS[s.status] || "#666" }}
              >
                {s.status}
              </span>
              <span className="session-date">
                {new Date(s.scheduled_at).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="session-card-body">
              <strong>{s.location}</strong>
              {s.court_number && <span> &middot; Court {s.court_number}</span>}
            </div>
            <div className="session-card-footer">
              {s.invitations.filter((i) => i.status === "booked").length}/
              {s.slots_needed} confirmed
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
