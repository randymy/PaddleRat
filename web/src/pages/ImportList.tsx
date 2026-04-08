import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getSharedListInfo, importSharedList } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function ImportList() {
  const { code } = useParams();
  const { token } = useAuth();
  const [info, setInfo] = useState<{ list_name: string; owner_name: string; players: { id: number; name: string; pti: number | null }[] } | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [done, setDone] = useState<{ imported: number; skipped: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code) return;
    getSharedListInfo(code)
      .then(setInfo)
      .catch(() => setInvalid(true));
  }, [code]);

  async function handleImport() {
    if (!code) return;
    setError("");
    setLoading(true);
    try {
      const result = await importSharedList(code);
      setDone(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (invalid) {
    return (
      <div className="page join-page">
        <h1>Invalid Link</h1>
        <p>This shared list link is expired or invalid.</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="page join-page">
        <h1>Log in to import</h1>
        <p>You need to be logged in as a Matchmaker to import contacts.</p>
        <Link to="/login" className="btn">Log In</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="page join-page">
        <h1>Contacts imported!</h1>
        <p>
          Added <strong>{done.imported}</strong> contact{done.imported !== 1 ? "s" : ""}
          {done.skipped > 0 && ` (${done.skipped} already in your contacts)`}
        </p>
        <Link to="/contacts" className="btn">Go to Contacts</Link>
      </div>
    );
  }

  if (!info) {
    return <div className="page"><p>Loading...</p></div>;
  }

  return (
    <div className="page">
      <h1>Shared Contacts</h1>
      <p><strong>{info.owner_name}</strong> shared their list "<strong>{info.list_name}</strong>" with you.</p>
      <p>{info.players.length} player{info.players.length !== 1 ? "s" : ""}:</p>

      <div className="contact-list" style={{ margin: "12px 0" }}>
        {info.players.map((p) => (
          <div key={p.id} className="contact-row">
            <div className="contact-info">
              <strong>{p.name}</strong>
              {p.pti && <span className="pti">PTI {p.pti}</span>}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      <button className="btn" onClick={handleImport} disabled={loading}>
        {loading ? "Importing..." : "Import All to My Contacts"}
      </button>
    </div>
  );
}
