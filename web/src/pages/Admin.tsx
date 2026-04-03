import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface WaitlistEntry {
  id: number;
  name: string;
  email: string;
  status: string;
  created_at: string;
}

export default function Admin() {
  const { user, token } = useAuth();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch(`${API_URL}/admin/waitlist`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setEntries(await res.json());
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleApprove(id: number) {
    const res = await fetch(`${API_URL}/admin/waitlist/${id}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      load();
    } else {
      const err = await res.json();
      alert(err.detail || "Failed to approve");
    }
  }

  if (user?.role !== "admin") {
    return (
      <div className="page">
        <h1>Access Denied</h1>
        <p>Admin access required.</p>
        <Link to="/dashboard">Back to Dashboard</Link>
      </div>
    );
  }

  const pending = entries.filter((e) => e.status === "pending");
  const approved = entries.filter((e) => e.status === "approved");

  return (
    <div className="page">
      <header className="header">
        <h1>Admin</h1>
        <Link to="/dashboard" className="btn-small btn-secondary">&larr; Back</Link>
      </header>

      <h2>Pending Requests ({pending.length})</h2>

      {loading && <p>Loading...</p>}

      {!loading && pending.length === 0 && (
        <p className="empty">No pending requests.</p>
      )}

      <div className="contact-list">
        {pending.map((e) => (
          <div key={e.id} className="contact-row">
            <div className="contact-info">
              <strong>{e.name}</strong>
              <span className="phone">{e.email}</span>
              <span className="phone">
                {new Date(e.created_at).toLocaleDateString()}
              </span>
            </div>
            <button
              className="btn-small"
              onClick={() => handleApprove(e.id)}
            >
              Approve
            </button>
          </div>
        ))}
      </div>

      <h2>Approved ({approved.length})</h2>

      <div className="contact-list">
        {approved.map((e) => (
          <div key={e.id} className="contact-row">
            <div className="contact-info">
              <strong>{e.name}</strong>
              <span className="phone">{e.email}</span>
            </div>
            <span className="directory-added">Approved</span>
          </div>
        ))}
      </div>
    </div>
  );
}
