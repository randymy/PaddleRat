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
  getSeries,
  getTeams,
  getTeamPlayers,
  createPlayer,
  type Contact,
  type Group,
  type GroupDetail,
  type DirectoryPlayer,
  type SeriesInfo,
  type TeamInfo,
  type TeamPlayer,
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
  const [seriesList, setSeriesList] = useState<SeriesInfo[]>([]);
  const [teamsList, setTeamsList] = useState<TeamInfo[]>([]);
  const [teamPlayers, setTeamPlayers] = useState<TeamPlayer[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<SeriesInfo | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<TeamInfo | null>(null);
  const [phoneInput, setPhoneInput] = useState<{ userId: number; value: string } | null>(null);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerPhone, setNewPlayerPhone] = useState("");
  const [newPlayerPti, setNewPlayerPti] = useState("");
  const [addPlayerError, setAddPlayerError] = useState("");

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
        <button
          onClick={() => setShowAddPlayer(!showAddPlayer)}
          className="btn btn-secondary"
        >
          {showAddPlayer ? "Cancel" : "+ Add Player"}
        </button>
      </div>

      {showAddPlayer && (
        <div className="add-player-form">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setAddPlayerError("");
              if (!newPlayerName.trim()) return;
              try {
                await createPlayer(
                  newPlayerName.trim(),
                  newPlayerPhone.trim() || undefined,
                  newPlayerPti ? parseFloat(newPlayerPti) : undefined,
                );
                setNewPlayerName("");
                setNewPlayerPhone("");
                setNewPlayerPti("");
                setShowAddPlayer(false);
                load();
              } catch (err: any) {
                setAddPlayerError(err.message);
              }
            }}
          >
            <input
              type="text"
              placeholder="Name"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              required
              autoFocus
            />
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={newPlayerPhone}
              onChange={(e) => setNewPlayerPhone(e.target.value)}
            />
            <input
              type="number"
              placeholder="PTI (optional)"
              value={newPlayerPti}
              onChange={(e) => setNewPlayerPti(e.target.value)}
              step="0.1"
            />
            {addPlayerError && <p className="error">{addPlayerError}</p>}
            <button type="submit">Add to Contacts</button>
          </form>
        </div>
      )}

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

          {/* ── Chicagoland Players ─────────────── */}
          <div className="section-header">
            <h2>Chicagoland Players</h2>
            <button
              className="btn-small"
              onClick={async () => {
                if (!showDirectory) {
                  const series = await getSeries();
                  setSeriesList(series);
                }
                setShowDirectory(!showDirectory);
                setSelectedSeries(null);
                setSelectedTeam(null);
                setTeamPlayers([]);
              }}
            >
              {showDirectory ? "Hide" : "Browse"}
            </button>
          </div>

          {showDirectory && (
            <div className="directory-section">
              {/* Search */}
              <input
                type="text"
                placeholder="Search all players by name..."
                value={directorySearch}
                onChange={async (e) => {
                  setDirectorySearch(e.target.value);
                  if (e.target.value.length >= 2) {
                    const res = await getDirectory(e.target.value, 50, 0);
                    setDirectoryPlayers(res.players);
                  } else {
                    setDirectoryPlayers([]);
                  }
                }}
              />

              {/* Search results */}
              {directorySearch.length >= 2 && (
                <div className="contact-list">
                  {directoryPlayers.map((p) => (
                    <PlayerRow
                      key={p.id}
                      id={p.id}
                      name={p.name}
                      pti={p.pti}
                      hasPhone={p.has_phone || false}
                      contacts={contacts}
                      phoneInput={phoneInput}
                      setPhoneInput={setPhoneInput}
                      onAdd={async (phone) => {
                        await addFromDirectory(p.id, phone);
                        setPhoneInput(null);
                        load();
                      }}
                    />
                  ))}
                  {directoryPlayers.length === 0 && (
                    <p className="empty">No players found.</p>
                  )}
                </div>
              )}

              {/* Browse by series/team */}
              {!directorySearch && (
                <>
                  {/* Breadcrumb */}
                  {(selectedSeries || selectedTeam) && (
                    <div className="browse-breadcrumb">
                      <button
                        className="btn-small btn-secondary"
                        onClick={() => {
                          if (selectedTeam) {
                            setSelectedTeam(null);
                            setTeamPlayers([]);
                          } else {
                            setSelectedSeries(null);
                            setTeamsList([]);
                          }
                        }}
                      >
                        &larr; Back
                      </button>
                      <span>
                        {selectedSeries?.name}
                        {selectedTeam && ` / ${selectedTeam.name}`}
                      </span>
                    </div>
                  )}

                  {/* Series list */}
                  {!selectedSeries && (
                    <div className="browse-list">
                      {seriesList.map((s) => (
                        <button
                          key={s.id}
                          className="browse-item"
                          onClick={async () => {
                            setSelectedSeries(s);
                            const teams = await getTeams(s.id);
                            setTeamsList(teams);
                          }}
                        >
                          <span>{s.name}</span>
                          <span className="browse-count">{s.team_count} teams &rsaquo;</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Teams list */}
                  {selectedSeries && !selectedTeam && (
                    <div className="browse-list">
                      {teamsList.map((t) => (
                        <button
                          key={t.id}
                          className="browse-item"
                          onClick={async () => {
                            setSelectedTeam(t);
                            const players = await getTeamPlayers(t.id);
                            setTeamPlayers(players);
                          }}
                        >
                          <span>{t.name}</span>
                          <span className="browse-count">&rsaquo;</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Team roster */}
                  {selectedTeam && (
                    <div className="contact-list">
                      {teamPlayers.map((p) => (
                        <PlayerRow
                          key={p.id}
                          id={p.id}
                          name={p.name}
                          pti={p.pti}
                          hasPhone={p.has_phone}
                          contacts={contacts}
                          phoneInput={phoneInput}
                          setPhoneInput={setPhoneInput}
                          onAdd={async (phone) => {
                            await addFromDirectory(p.id, phone);
                            setPhoneInput(null);
                            load();
                          }}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PlayerRow({
  id, name, pti, hasPhone, contacts, phoneInput, setPhoneInput, onAdd,
}: {
  id: number;
  name: string;
  pti: number | null;
  hasPhone: boolean;
  contacts: Contact[];
  phoneInput: { userId: number; value: string } | null;
  setPhoneInput: (v: { userId: number; value: string } | null) => void;
  onAdd: (phone?: string) => Promise<void>;
}) {
  const alreadyAdded = contacts.some((c) => c.user_id === id);
  const isEditingPhone = phoneInput?.userId === id;

  return (
    <div className="contact-row">
      <div className="contact-info">
        <strong>{name}</strong>
        {pti && <span className="pti">PTI {pti}</span>}
      </div>
      {alreadyAdded ? (
        <span className="directory-added">Added</span>
      ) : isEditingPhone ? (
        <div className="phone-input-row">
          <input
            type="tel"
            placeholder="Phone number"
            value={phoneInput.value}
            onChange={(e) => setPhoneInput({ userId: id, value: e.target.value })}
            autoFocus
          />
          <button
            className="btn-small"
            onClick={() => onAdd(phoneInput.value)}
            disabled={!phoneInput.value}
          >
            Save
          </button>
          <button
            className="btn-small btn-secondary"
            onClick={() => setPhoneInput(null)}
          >
            Cancel
          </button>
        </div>
      ) : hasPhone ? (
        <button className="btn-small" onClick={() => onAdd()}>
          + Add
        </button>
      ) : (
        <button
          className="btn-small btn-secondary"
          onClick={() => setPhoneInput({ userId: id, value: "" })}
        >
          + Add with phone
        </button>
      )}
    </div>
  );
}
