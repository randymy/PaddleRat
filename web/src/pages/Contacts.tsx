import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getContacts,
  deleteContact,
  createInviteLink,
  getGroups,
  getGroup,
  createGroup,
  deleteGroup,
  addGroupMember,
  removeGroupMember,
  getDirectory,
  addFromDirectory,
  type Contact,
  type Group,
  type GroupDetail,
  type DirectoryPlayer,
} from "../lib/api";

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteLink, setInviteLink] = useState("");
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [showAddToList, setShowAddToList] = useState(false);
  const [showDirectory, setShowDirectory] = useState(false);
  const [directoryPlayers, setDirectoryPlayers] = useState<DirectoryPlayer[]>([]);
  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryTotal, setDirectoryTotal] = useState(0);

  function load() {
    Promise.all([getContacts(), getGroups()])
      .then(([c, g]) => {
        setContacts(c);
        setGroups(g);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleDeleteContact(id: number, name: string) {
    if (!confirm(`Remove ${name} from your contacts?`)) return;
    await deleteContact(id);
    load();
    if (selectedGroup) {
      const updated = await getGroup(selectedGroup.id);
      setSelectedGroup(updated);
    }
  }

  async function handleCreateList(e: React.FormEvent) {
    e.preventDefault();
    if (!newListName.trim()) return;
    await createGroup(newListName.trim());
    setNewListName("");
    setShowNewList(false);
    load();
  }

  async function handleDeleteList(id: number, name: string) {
    if (!confirm(`Delete list "${name}"?`)) return;
    await deleteGroup(id);
    if (selectedGroup?.id === id) setSelectedGroup(null);
    load();
  }

  async function handleSelectList(id: number) {
    const detail = await getGroup(id);
    setSelectedGroup(detail);
  }

  async function handleAddToList(contactId: number) {
    if (!selectedGroup) return;
    try {
      await addGroupMember(selectedGroup.id, contactId);
      const updated = await getGroup(selectedGroup.id);
      setSelectedGroup(updated);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleRemoveFromList(contactId: number) {
    if (!selectedGroup) return;
    await removeGroupMember(selectedGroup.id, contactId);
    const updated = await getGroup(selectedGroup.id);
    setSelectedGroup(updated);
  }

  const listMemberIds = new Set(selectedGroup?.members.map((m) => m.contact_id) || []);
  const availableContacts = contacts.filter((c) => !listMemberIds.has(c.id));

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
          <p className="empty">They'll tap it, find themselves in the player database, and enter their phone number.</p>
        </div>
      )}

      {loading && <p>Loading...</p>}

      {/* ── Lists Section ──────────────────────────── */}
      {!loading && (
        <>
          <div className="section-header">
            <h2>Lists</h2>
            <button
              className="btn-small"
              onClick={() => setShowNewList(!showNewList)}
            >
              {showNewList ? "Cancel" : "+ New List"}
            </button>
          </div>

          {showNewList && (
            <form onSubmit={handleCreateList} className="inline-form">
              <input
                type="text"
                placeholder="List name (e.g. Tuesday Night Crew)"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn-small">Create</button>
            </form>
          )}

          {groups.length === 0 && !showNewList && (
            <p className="empty">No lists yet. Create one to organize your contacts.</p>
          )}

          <div className="list-chips">
            {groups.map((g) => (
              <button
                key={g.id}
                className={`list-chip ${selectedGroup?.id === g.id ? "active" : ""}`}
                onClick={() => handleSelectList(g.id)}
              >
                {g.name} &rsaquo;
              </button>
            ))}
          </div>

          {/* ── Selected List Members ──────────────── */}
          {selectedGroup && (
            <div className="list-detail">
              <div className="section-header">
                <h3>{selectedGroup.name}</h3>
                <div className="list-detail-actions">
                  <button
                    className="btn-small"
                    onClick={() => setShowAddToList(!showAddToList)}
                  >
                    {showAddToList ? "Done" : "+ Add"}
                  </button>
                  <button
                    className="btn-small btn-danger"
                    onClick={() => handleDeleteList(selectedGroup.id, selectedGroup.name)}
                  >
                    Delete List
                  </button>
                </div>
              </div>

              {selectedGroup.members.length === 0 && !showAddToList && (
                <p className="empty">No members yet. Add contacts to this list.</p>
              )}

              {selectedGroup.members.map((m) => (
                <div key={m.contact_id} className="contact-row">
                  <div className="contact-info">
                    <strong>{m.name}</strong>
                    {m.pti && <span className="pti">PTI {m.pti}</span>}
                  </div>
                  <button
                    className="btn-small btn-danger"
                    onClick={() => handleRemoveFromList(m.contact_id)}
                  >
                    Remove
                  </button>
                </div>
              ))}

              {showAddToList && (
                <div className="add-to-list">
                  <p className="empty">Tap a contact to add to "{selectedGroup.name}":</p>
                  {availableContacts.map((c) => (
                    <div key={c.id} className="contact-row add-row">
                      <div className="contact-info">
                        <strong>{c.user.name}</strong>
                        {c.user.pti && <span className="pti">PTI {c.user.pti}</span>}
                      </div>
                      <button
                        className="btn-small"
                        onClick={() => handleAddToList(c.id)}
                      >
                        + Add
                      </button>
                    </div>
                  ))}
                  {availableContacts.length === 0 && (
                    <p className="empty">All contacts are already in this list.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── All Contacts ──────────────────────── */}
          <div className="section-header">
            <h2>All Contacts</h2>
            <span className="contact-count">{contacts.length}</span>
          </div>

          {contacts.length === 0 && (
            <p className="empty">No contacts yet. Share an invite link to get started.</p>
          )}

          <div className="contact-list">
            {contacts.map((c) => (
              <div key={c.id} className="contact-row">
                <div className="contact-info">
                  <strong>{c.user.name}</strong>
                  {c.user.pti && <span className="pti">PTI {c.user.pti}</span>}
                  {c.user.phone && <span className="phone">{c.user.phone}</span>}
                </div>
                <button
                  className="btn-small btn-danger"
                  onClick={() => handleDeleteContact(c.id, c.user.name)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {/* ── Chicagoland Players Directory ───── */}
          <div className="section-header">
            <h2>Chicagoland Players</h2>
            <button
              className="btn-small"
              onClick={async () => {
                if (!showDirectory) {
                  const res = await getDirectory("", 50, 0);
                  setDirectoryPlayers(res.players);
                  setDirectoryTotal(res.total);
                }
                setShowDirectory(!showDirectory);
              }}
            >
              {showDirectory ? "Hide" : "Browse"}
            </button>
          </div>

          {showDirectory && (
            <div className="directory-section">
              <p className="empty" style={{ margin: "0 0 10px" }}>
                Players who opted in to be found by other Chicagoland players.
              </p>
              <input
                type="text"
                placeholder="Search by name..."
                value={directorySearch}
                onChange={async (e) => {
                  setDirectorySearch(e.target.value);
                  const res = await getDirectory(e.target.value, 50, 0);
                  setDirectoryPlayers(res.players);
                  setDirectoryTotal(res.total);
                }}
              />
              {directoryPlayers.length === 0 && (
                <p className="empty">No players found. As more people opt in, they'll appear here.</p>
              )}
              <div className="contact-list">
                {directoryPlayers.map((p) => {
                  const alreadyAdded = contacts.some((c) => c.user_id === p.id);
                  return (
                    <div key={p.id} className="contact-row">
                      <div className="contact-info">
                        <strong>{p.name}</strong>
                        {p.pti && <span className="pti">PTI {p.pti}</span>}
                      </div>
                      {alreadyAdded ? (
                        <span className="directory-added">Added</span>
                      ) : (
                        <button
                          className="btn-small"
                          onClick={async () => {
                            await addFromDirectory(p.id);
                            load();
                          }}
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {directoryTotal > directoryPlayers.length && (
                <p className="empty">{directoryTotal - directoryPlayers.length} more players...</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
