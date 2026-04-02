import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getContacts,
  importContacts,
  deleteContact,
  createInviteLink,
  type Contact,
} from "../lib/api";

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  function load() {
    getContacts().then(setContacts).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setImportError("");

    // Parse the text: expect "Name, Phone" per line
    const lines = importText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l);

    const parsed = lines.map((line) => {
      const parts = line.split(/[,\t]+/).map((p) => p.trim());
      if (parts.length < 2) return null;
      return { name: parts[0], phone: parts[1] };
    });

    const valid = parsed.filter(Boolean) as { name: string; phone: string }[];

    if (valid.length === 0) {
      setImportError(
        'Enter contacts as "Name, Phone" — one per line.'
      );
      return;
    }

    setImporting(true);
    try {
      const result = await importContacts(valid);
      setImportText("");
      setShowImport(false);
      load();
      alert(
        `Imported ${result.imported} contact${result.imported !== 1 ? "s" : ""}` +
          (result.skipped ? ` (${result.skipped} already existed)` : "")
      );
    } catch (err: any) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Remove ${name} from your contacts?`)) return;
    await deleteContact(id);
    load();
  }

  return (
    <div className="page">
      <header className="header">
        <h1>Contacts</h1>
        <Link to="/dashboard" className="btn-small btn-secondary">&larr; Back</Link>
      </header>

      <div className="contact-buttons">
        <button
          onClick={async () => {
            const res = await createInviteLink();
            const link = `${window.location.origin}${res.link}`;
            setInviteLink(link);
            navigator.clipboard.writeText(link).catch(() => {});
          }}
          className="btn"
        >
          Share Invite Link
        </button>
        <button onClick={() => setShowImport(!showImport)} className="btn btn-secondary">
          {showImport ? "Cancel" : "Paste Contacts"}
        </button>
      </div>

      {inviteLink && (
        <div className="invite-link-box">
          <p>Send this link to your paddle friends:</p>
          <div className="invite-link-row">
            <input type="text" value={inviteLink} readOnly />
            <button
              className="btn-small"
              onClick={() => {
                navigator.clipboard.writeText(inviteLink);
                alert("Link copied!");
              }}
            >
              Copy
            </button>
          </div>
          <p className="empty">They'll tap it, find themselves in the APTA database, and enter their phone number.</p>
        </div>
      )}

      {showImport && (
        <form onSubmit={handleImport} className="import-form">
          <p>Paste contacts — one per line, as <strong>Name, Phone</strong>:</p>
          <textarea
            rows={8}
            placeholder={"Dave Chen, 312-555-1234\nMia Torres, 773-555-5678"}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          {importError && <p className="error">{importError}</p>}
          <button type="submit" disabled={importing}>
            {importing ? "Importing..." : "Import"}
          </button>
        </form>
      )}

      {loading && <p>Loading...</p>}

      {!loading && contacts.length === 0 && (
        <p className="empty">
          No contacts yet. Import some to start inviting players.
        </p>
      )}

      <div className="contact-list">
        {contacts.map((c) => (
          <div key={c.id} className="contact-row">
            <div className="contact-info">
              <strong>{c.user.name}</strong>
              {c.user.pti && <span className="pti">PTI {c.user.pti}</span>}
              {c.user.phone && (
                <span className="phone">{c.user.phone}</span>
              )}
            </div>
            <button
              className="btn-small btn-danger"
              onClick={() => handleDelete(c.id, c.user.name)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
