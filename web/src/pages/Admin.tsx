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
  const [userRoles, setUserRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch(`${API_URL}/admin/waitlist`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setEntries(data);

      // Fetch roles for approved entries
      const approved = data.filter((e: WaitlistEntry) => e.status === "approved");
      const roles: Record<string, string> = {};
      for (const entry of approved) {
        const userRes = await fetch(`${API_URL}/admin/users?search=${encodeURIComponent(entry.email)}&limit=1`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (userRes.ok) {
          const users = await userRes.json();
          if (users.length > 0) roles[entry.email] = users[0].role;
        }
      }
      setUserRoles(roles);
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

  async function handleDeny(id: number, name: string) {
    if (!confirm(`Deny ${name}'s request?`)) return;
    const res = await fetch(`${API_URL}/admin/waitlist/${id}/deny`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      load();
    } else {
      const err = await res.json();
      alert(err.detail || "Failed to deny");
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
            <div className="contact-actions">
              <button
                className="btn-small"
                onClick={() => handleApprove(e.id)}
              >
                Approve
              </button>
              <button
                className="btn-small btn-danger"
                onClick={() => handleDeny(e.id, e.name)}
              >
                Deny
              </button>
            </div>
          </div>
        ))}
      </div>

      <h2>Approved Matchmakers ({approved.length})</h2>

      <div className="contact-list">
        {approved.map((e) => (
          <div key={e.id} className="contact-row">
            <div className="contact-info">
              <strong>{e.name}</strong>
              <span className="phone">{e.email}</span>
            </div>
            <div className="contact-actions">
              <span className="directory-added">Approved</span>
              {userRoles[e.email] === "admin" && (
                <span className="status-badge" style={{ background: "#9C27B0" }}>Admin</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <UserManager token={token!} />
    </div>
  );
}

function UserManager({ token }: { token: string }) {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ id: number; name: string; phone: string | null; pti: number | null; role: string }[]>([]);

  async function handleSearch() {
    if (search.length < 2) return;
    const res = await fetch(`${API_URL}/admin/users?search=${encodeURIComponent(search)}&limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setResults(await res.json());
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete ${name} and all their data? This cannot be undone.`)) return;
    const res = await fetch(`${API_URL}/admin/users/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setResults(results.filter((r) => r.id !== id));
    } else {
      const err = await res.json();
      alert(err.detail || "Failed to delete");
    }
  }

  return (
    <>
      <h2>Manage Database</h2>
      <div className="inline-form">
        <input
          type="text"
          placeholder="Search users by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <button className="btn-small" onClick={handleSearch}>Search</button>
      </div>

      {results.length > 0 && (
        <div className="contact-list">
          {results.map((u) => (
            <div key={u.id} className="contact-row">
              <div className="contact-info">
                <strong>{u.name}</strong>
                {u.pti && <span className="pti">PTI {u.pti}</span>}
                {u.phone && <span className="phone">{u.phone}</span>}
                <span className="phone">{u.role}</span>
              </div>
              <button
                className="btn-small btn-danger"
                onClick={() => handleDelete(u.id, u.name)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
