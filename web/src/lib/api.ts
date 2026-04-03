const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function getToken(): string | null {
  return localStorage.getItem("token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
export async function login(email: string) {
  return request<{ status: string; message: string; _dev_link?: string }>(
    "/auth/login",
    { method: "POST", body: JSON.stringify({ email }) }
  );
}

export async function verify(token: string) {
  return request<{ token: string; user: User }>(`/auth/verify?token=${token}`);
}

// Sessions
export async function getSessions() {
  return request<Session[]>("/sessions");
}

export async function getSession(id: number) {
  return request<Session>(`/sessions/${id}`);
}

export async function createSession(data: CreateSessionPayload) {
  return request<Session>("/sessions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function cancelSession(id: number) {
  return request<Session>(`/sessions/${id}/cancel`, { method: "PATCH" });
}

export async function remindSession(id: number) {
  return request<Session>(`/sessions/${id}/remind`, { method: "POST" });
}

// Contacts
export async function getContacts() {
  return request<Contact[]>("/contacts");
}

export async function importContacts(
  contacts: { name: string; phone: string }[]
) {
  return request<{ imported: number; skipped: number; contacts: Contact[] }>(
    "/contacts/import",
    { method: "POST", body: JSON.stringify({ contacts }) }
  );
}

export async function deleteContact(id: number) {
  return request<void>(`/contacts/${id}`, { method: "DELETE" });
}

// Groups
export async function getGroups() {
  return request<Group[]>("/groups");
}

export async function createGroup(name: string) {
  return request<Group>("/groups", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function getGroup(id: number) {
  return request<GroupDetail>(`/groups/${id}`);
}

export async function deleteGroup(id: number) {
  return request<void>(`/groups/${id}`, { method: "DELETE" });
}

export async function addGroupMember(groupId: number, contactId: number) {
  return request<{ status: string }>(`/groups/${groupId}/members`, {
    method: "POST",
    body: JSON.stringify({ contact_id: contactId }),
  });
}

export async function removeGroupMember(groupId: number, contactId: number) {
  return request<void>(`/groups/${groupId}/members/${contactId}`, {
    method: "DELETE",
  });
}

// Invite links (public — no auth needed)
export async function createInviteLink() {
  return request<{ code: string; link: string; ratking_name: string }>(
    "/invite/link",
    { method: "POST" }
  );
}

export async function getInviteInfo(code: string) {
  const res = await fetch(`${API_URL}/invite/link/${code}`);
  if (!res.ok) throw new Error("Invalid invite link");
  return res.json() as Promise<{ ratking_name: string }>;
}

export async function searchPlayers(q: string) {
  const res = await fetch(`${API_URL}/invite/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  return res.json() as Promise<{ id: number; name: string; pti: number | null }[]>;
}

export async function joinViaLink(code: string, userId: number, phone: string) {
  const res = await fetch(`${API_URL}/invite/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, user_id: userId, phone }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to join" }));
    throw new Error(err.detail);
  }
  return res.json() as Promise<{
    status: string;
    name: string;
    pti: number | null;
    message: string;
  }>;
}

export async function setPhonePublic(userId: number, phonePublic: boolean) {
  const res = await fetch(`${API_URL}/invite/opt-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, phone_public: phonePublic }),
  });
  return res.json();
}

// Directory
export async function getDirectory(search: string = "", limit = 50, offset = 0) {
  return request<{ players: DirectoryPlayer[]; total: number }>(
    `/directory?search=${encodeURIComponent(search)}&limit=${limit}&offset=${offset}`
  );
}

export async function addFromDirectory(userId: number) {
  return request<{ status: string }>(`/directory/add/${userId}`, {
    method: "POST",
  });
}

// Types
export interface DirectoryPlayer {
  id: number;
  name: string;
  pti: number | null;
}

export interface User {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  role: string;
  pti: number | null;
  created_at: string;
}

export interface Invitation {
  id: number;
  user_id: number;
  user: User;
  tier: number;
  status: string;
  invited_at: string;
  responded_at: string | null;
  expires_at: string;
}

export interface Session {
  id: number;
  ratking_id: number;
  location: string;
  court_number: string | null;
  scheduled_at: string;
  slots_needed: number;
  expires_in_minutes: number;
  status: string;
  created_at: string;
  invitations: Invitation[];
}

export interface Contact {
  id: number;
  owner_id: number;
  user_id: number;
  nickname: string | null;
  priority: number;
  created_at: string;
  user: User;
}

export interface Group {
  id: number;
  owner_id: number;
  name: string;
  created_at: string;
}

export interface GroupMemberInfo {
  contact_id: number;
  name: string;
  pti: number | null;
  phone: string | null;
  user_id: number;
}

export interface GroupDetail {
  id: number;
  name: string;
  members: GroupMemberInfo[];
}

export interface CreateSessionPayload {
  location: string;
  court_number?: string;
  scheduled_at: string;
  slots_needed: number;
  expires_in_minutes: number;
  invite_user_ids: number[];
  backup_user_ids: number[];
}
