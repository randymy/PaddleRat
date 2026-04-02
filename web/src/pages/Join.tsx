import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getInviteInfo, searchPlayers, joinViaLink } from "../lib/api";

interface PlayerMatch {
  id: number;
  name: string;
  pti: number | null;
}

export default function Join() {
  const { code } = useParams();
  const [ratkingName, setRatkingName] = useState("");
  const [invalid, setInvalid] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerMatch[]>([]);
  const [selected, setSelected] = useState<PlayerMatch | null>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ name: string; pti: number | null; message: string } | null>(null);

  useEffect(() => {
    if (!code) return;
    getInviteInfo(code)
      .then((info) => setRatkingName(info.ratking_name))
      .catch(() => setInvalid(true));
  }, [code]);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      searchPlayers(query).then(setResults);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !phone || !code) return;
    setError("");
    setLoading(true);
    try {
      const res = await joinViaLink(code, selected.id, phone);
      setDone(res);
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
        <p>This invite link is expired or invalid. Ask your friend for a new one.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="page join-page">
        <h1>You're in!</h1>
        <p className="join-name">{done.name}</p>
        {done.pti && <p className="join-pti">PTI {done.pti}</p>}
        <p>{done.message}</p>
        <p className="join-note">
          When {ratkingName} books a court, you'll get a text.
          Just reply <strong>Y</strong> to join.
        </p>
      </div>
    );
  }

  return (
    <div className="page join-page">
      <h1>{ratkingName} invited you to PaddleRats</h1>
      <p>Find yourself and enter your phone number to connect.</p>

      <form onSubmit={handleJoin}>
        {!selected ? (
          <>
            <label>
              Your Name
              <input
                type="text"
                placeholder="Start typing your name..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(null);
                }}
                autoFocus
              />
            </label>

            {results.length > 0 && (
              <div className="search-results">
                {results.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    className="search-result"
                    onClick={() => {
                      setSelected(p);
                      setQuery(p.name);
                      setResults([]);
                    }}
                  >
                    <strong>{p.name}</strong>
                    {p.pti && <span className="pti">PTI {p.pti}</span>}
                  </button>
                ))}
              </div>
            )}

            {query.length >= 2 && results.length === 0 && (
              <p className="empty">No players found matching "{query}"</p>
            )}
          </>
        ) : (
          <div className="selected-player">
            <div className="selected-info">
              <strong>{selected.name}</strong>
              {selected.pti && <span className="pti">PTI {selected.pti}</span>}
            </div>
            <button
              type="button"
              className="btn-small btn-secondary"
              onClick={() => {
                setSelected(null);
                setQuery("");
              }}
            >
              Change
            </button>
          </div>
        )}

        {selected && (
          <>
            <label>
              Your Phone Number
              <input
                type="tel"
                placeholder="312-555-1234"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                required
              />
            </label>

            {error && <p className="error">{error}</p>}

            <button type="submit" disabled={loading}>
              {loading ? "Joining..." : "Join"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
