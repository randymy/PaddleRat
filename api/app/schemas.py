from datetime import datetime

from pydantic import BaseModel


# ── Users ────────────────────────────────────────────────────────────────

class UserPublic(BaseModel):
    """Safe to show to other users — no phone or email."""
    id: int
    name: str
    pti: float | None

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    """Full user info — only for the user viewing their own data or admin."""
    id: int
    name: str
    phone: str | None
    email: str | None
    role: str
    pti: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    name: str
    phone: str | None = None
    email: str | None = None
    role: str = "rat"
    pti: float | None = None


class UserRoleUpdate(BaseModel):
    role: str


# ── Contacts ─────────────────────────────────────────────────────────────

class ContactOut(BaseModel):
    id: int
    owner_id: int
    user_id: int
    nickname: str | None
    priority: int
    created_at: datetime
    user: UserOut

    model_config = {"from_attributes": True}


class ContactCreate(BaseModel):
    user_id: int
    nickname: str | None = None
    priority: int = 0


class ContactImportItem(BaseModel):
    name: str
    phone: str


class ContactImportRequest(BaseModel):
    contacts: list[ContactImportItem]


class ContactImportResult(BaseModel):
    imported: int
    skipped: int
    contacts: list[ContactOut]


# ── Groups ───────────────────────────────────────────────────────────────

class GroupOut(BaseModel):
    id: int
    owner_id: int
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class GroupCreate(BaseModel):
    name: str


class GroupMemberAdd(BaseModel):
    contact_id: int


# ── Sessions ─────────────────────────────────────────────────────────────

class InvitationOut(BaseModel):
    id: int
    user_id: int
    user: UserPublic
    tier: int
    position: int
    status: str
    invited_at: datetime | None
    responded_at: datetime | None
    expires_at: datetime

    model_config = {"from_attributes": True}


class SessionOut(BaseModel):
    id: int
    ratking_id: int
    location: str
    court_number: str | None
    scheduled_at: datetime
    slots_needed: int
    expires_in_minutes: int
    status: str
    created_at: datetime
    invitations: list[InvitationOut] = []

    model_config = {"from_attributes": True}


class SessionCreate(BaseModel):
    location: str
    court_number: str | None = None
    scheduled_at: datetime
    slots_needed: int = 3
    expires_in_minutes: int = 120
    invite_user_ids: list[int] = []
    backup_user_ids: list[int] = []


class SessionCancel(BaseModel):
    pass
