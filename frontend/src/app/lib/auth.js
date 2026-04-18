// src/lib/auth.js
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:10000";
const TOKEN_KEY = "access_token";
export const AUTH_CHANGED_EVENT = "auth-changed";

function emitAuthChanged(user = null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: { user } }));
}

export function notifyAuthChanged(user = null) {
  emitAuthChanged(user);
}

// Store token in localStorage (MVP – later we can move to HttpOnly cookies)
export function saveToken(token) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  emitAuthChanged();
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  emitAuthChanged();
}

// Fetch helper that auto-attaches Authorization header
export async function authFetch(path, init = {}) {
  const token = getToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API}${path}`, { ...init, headers });
}

// --- AUTH HELPERS --- //

// Call FastAPI /login, then save token
export async function loginWithEmail(email, password) {
  const res = await fetch(`${API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, password }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("Login failed:", res.status, txt);
    throw new Error("Invalid email or password.");
  }

  const data = await res.json();
  if (!data?.access_token) {
    throw new Error("Login failed: no token returned.");
  }

  saveToken(data.access_token);
  return data.access_token;
}

// Call FastAPI /signup to create a new user
export async function signup(name, email, password) {
  const res = await fetch(`${API}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ name, email, password }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("Signup failed:", res.status, txt);
    throw new Error("Signup failed. This email may already be in use.");
  }

  return res.json(); // { message, user_id }
}

export async function submitContactForm({ name, email, phone, message }) {
  const body = new FormData();
  body.append("name", name);
  body.append("email", email);
  if (phone) body.append("phone", phone);
  body.append("message", message);

  const res = await fetch(`${API}/contact`, {
    method: "POST",
    headers: { "x-requested-with": "fetch" },
    body,
  });

  if (!res.ok) {
    let detail = "Failed to submit contact form.";
    try {
      const data = await res.json();
      if (typeof data?.detail === "string" && data.detail.trim()) {
        detail = data.detail;
      }
    } catch {
      const txt = await res.text().catch(() => "");
      if (txt) detail = txt;
    }
    throw new Error(detail);
  }

  return res.json();
}

// Call FastAPI /profile to get user + role
export async function fetchMe() {
  const res = await authFetch("/profile"); // IMPORTANT: match backend route
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("fetchMe failed:", res.status, txt);
    throw new Error("Not authenticated");
  }
  return res.json(); // { email, role }
}

// Unified: fetch matters for current user based on role (backend handles it)
export async function fetchMyMatters() {
  const res = await authFetch("/matters");
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("fetchMyMatters failed:", res.status, txt);
    throw new Error("Failed to load matters");
  }
  return res.json();
}

export async function fetchMatter(matterId) {
  const res = await authFetch(`/matters/${matterId}`);
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error("You do not have access to this matter.");
    }
    if (res.status === 404) {
      throw new Error("Matter not found.");
    }
    const txt = await res.text().catch(() => "");
    console.error("fetchMatter failed:", res.status, txt);
    throw new Error("Failed to load matter.");
  }
  return res.json();
}

export async function updateMatter(matterId, payload) {
  const res = await authFetch(`/matters/${matterId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("updateMatter failed:", res.status, txt);
    throw new Error(txt || "Failed to update matter");
  }

  return res.json();
}

export async function createMatter(payload) {
  const res = await authFetch("/matters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("createMatter failed:", res.status, txt);
    throw new Error(txt || "Failed to create matter");
  }

  return res.json();
}

export async function searchClients(query) {
  const res = await authFetch(
    `/lawyer/clients?query=${encodeURIComponent(query)}`
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("searchClients failed:", res.status, txt);
    throw new Error("Failed to search clients");
  }

  return res.json(); // [{id,name,email}]
}

export async function createClientInvitation(payload) {
  const res = await authFetch("/lawyer/invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let detail = "Failed to create invitation";
    try {
      const data = await res.json();
      if (typeof data?.detail === "string" && data.detail.trim()) {
        detail = data.detail;
      }
    } catch {
      const txt = await res.text().catch(() => "");
      if (txt) detail = txt;
    }
    console.error("createClientInvitation failed:", res.status, detail);
    throw new Error(detail);
  }

  return res.json();
}

export async function fetchInvitation(token) {
  const res = await fetch(`${API}/invitations/${token}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("fetchInvitation failed:", res.status, txt);
    throw new Error("Invitation is invalid or expired");
  }
  return res.json();
}

export async function acceptInvitation(token, password) {
  const res = await fetch(`${API}/invitations/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });

  if (!res.ok) {
    let detail = "Failed to accept invitation";
    try {
      const data = await res.json();
      if (typeof data?.detail === "string" && data.detail.trim()) {
        detail = data.detail;
      }
    } catch {
      const txt = await res.text().catch(() => "");
      if (txt) detail = txt;
    }
    console.error("acceptInvitation failed:", res.status, detail);
    throw new Error(detail);
  }

  return res.json();
}

export async function requestPasswordReset(email) {
  const res = await fetch(`${API}/password-reset/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("requestPasswordReset failed:", res.status, txt);
    throw new Error("Failed to request password reset");
  }

  return res.json();
}

export async function fetchPasswordResetToken(token) {
  const res = await fetch(`${API}/password-reset/${token}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("fetchPasswordResetToken failed:", res.status, txt);
    throw new Error("Reset link is invalid or expired");
  }

  return res.json();
}

export async function confirmPasswordReset(token, password) {
  const res = await fetch(`${API}/password-reset/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });

  if (!res.ok) {
    let detail = "Failed to reset password";
    try {
      const data = await res.json();
      if (typeof data?.detail === "string" && data.detail.trim()) {
        detail = data.detail;
      }
    } catch {
      const txt = await res.text().catch(() => "");
      if (txt) detail = txt;
    }
    console.error("confirmPasswordReset failed:", res.status, detail);
    throw new Error(detail);
  }

  return res.json();
}

// --- DOCUMENT UPLOAD FLOW --- //

export async function presignMatterUpload(matterId, fileName, contentType) {
  const res = await authFetch(`/matters/${matterId}/uploads/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_name: fileName, content_type: contentType }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("presignMatterUpload failed:", res.status, txt);
    throw new Error(txt || "Failed to presign upload");
  }

  return res.json(); // { upload_url, object_key }
}

export async function completeMatterUpload(matterId, fileName, objectKey) {
  const res = await authFetch(`/matters/${matterId}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_name: fileName, object_key: objectKey }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("completeMatterUpload failed:", res.status, txt);
    throw new Error(txt || "Failed to save document record");
  }

  return res.json();
}

export async function fetchMatterDocuments(matterId) {
  const res = await authFetch(`/matters/${matterId}/documents`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("fetchMatterDocuments failed:", res.status, txt);
    throw new Error("Failed to load documents");
  }
  return res.json();
}

export async function fetchInternalNotes(matterId) {
  const res = await authFetch(`/matters/${matterId}/internal-notes`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("fetchInternalNotes failed:", res.status, txt);
    throw new Error("Failed to load internal notes");
  }
  return res.json();
}

export async function createInternalNote(matterId, content) {
  const res = await authFetch(`/matters/${matterId}/internal-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("createInternalNote failed:", res.status, txt);
    throw new Error(txt || "Failed to create internal note");
  }

  return res.json();
}

export async function fetchSharedUpdates(matterId) {
  const res = await authFetch(`/matters/${matterId}/shared-updates`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("fetchSharedUpdates failed:", res.status, txt);
    throw new Error("Failed to load shared updates");
  }
  return res.json();
}

export async function createSharedUpdate(matterId, content) {
  const res = await authFetch(`/matters/${matterId}/shared-updates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("createSharedUpdate failed:", res.status, txt);
    throw new Error(txt || "Failed to create shared update");
  }

  return res.json();
}

export async function fetchMatterEvents(matterId) {
  const res = await authFetch(`/matters/${matterId}/events`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("fetchMatterEvents failed:", res.status, txt);
    throw new Error("Failed to load activity");
  }
  return res.json();
}

export async function getDocumentAccessLinks(documentId) {
  const res = await authFetch(`/documents/${documentId}/access-links`, {
    method: "POST",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("getDocumentAccessLinks failed:", res.status, txt);
    throw new Error("Failed to get document access links.");
  }
  return res.json();
}

// CONVENIENCE HELPERS which UI uses

/**
 * Full upload flow:
 * 1) Ask backend for a presigned PUT URL
 * 2) PUT the file directly to S3
 * 3) Tell backend to create the Document DB record
 *
 * Returns the created document record.
 */
export async function uploadMatterFile(matterId, file) {
  if (!matterId) throw new Error("matterId is required");
  if (!file) throw new Error("No file selected");

  const fileName = file.name;
  const contentType = file.type || "application/octet-stream";

  // presign
  const { upload_url, object_key } = await presignMatterUpload(
    matterId,
    fileName,
    contentType
  );

  // upload to S3 (direct from browser)
  const putRes = await fetch(upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: file,
  });

  if (!putRes.ok) {
    const txt = await putRes.text().catch(() => "");
    console.error("S3 PUT failed:", putRes.status, txt);
    throw new Error("Upload to S3 failed.");
  }

  // create DB record
  return completeMatterUpload(matterId, fileName, object_key);
}

export async function fetchMatterDetail(matterId) {
  return fetchMatter(matterId);
}
