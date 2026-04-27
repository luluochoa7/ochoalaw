// src/lib/auth.js
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:10000";
const CSRF_COOKIE_NAME = "ocl_csrf";
export const AUTH_CHANGED_EVENT = "auth-changed";

let refreshInFlight = null;
let meInFlight = null;
let meCache = null;

function emitAuthChanged(user = null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: { user } }));
}

export function notifyAuthChanged(user = null) {
  meCache = user;
  emitAuthChanged(user);
}

function getCookie(name) {
  if (typeof document === "undefined") return "";
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return decodeURIComponent(parts.pop().split(";").shift() || "");
  }
  return "";
}

function getCsrfToken() {
  return getCookie(CSRF_COOKIE_NAME);
}

async function refreshSessionOnce() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = fetch(`${API}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: {
      "X-CSRF-Token": getCsrfToken(),
    },
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

export async function authFetch(path, options = {}, retry = true) {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers.set("X-CSRF-Token", csrfToken);
    }
  }

  const res = await fetch(`${API}${path}`, {
    ...options,
    method,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && retry) {
    const refreshed = await refreshSessionOnce();
    if (refreshed) {
      return authFetch(path, options, false);
    }
  }

  return res;
}

// --- AUTH HELPERS --- //

export async function loginWithEmail(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("Login failed:", res.status, txt);
    throw new Error("Invalid email or password.");
  }

  const data = await res.json();
  if (data?.user) {
    notifyAuthChanged(data.user);
  }
  return data;
}

export async function logout() {
  const res = await authFetch(
    "/auth/logout",
    {
      method: "POST",
    },
    false
  );
  meCache = null;
  meInFlight = null;
  notifyAuthChanged(null);
  return res.ok;
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

export async function fetchMe(retry = false) {
  if (meCache) return meCache;
  if (meInFlight) return meInFlight;

  meInFlight = fetch(`${API}/auth/me`, {
    method: "GET",
    credentials: "include",
  })
    .then(async (res) => {
      if (res.status === 401 && retry) {
        const refreshed = await refreshSessionOnce();
        if (refreshed) {
          meInFlight = null;
          return fetchMe(false);
        }
      }
      if (!res.ok) {
        meCache = null;
        throw new Error("Not authenticated");
      }
      meCache = await res.json();
      return meCache;
    })
    .catch((err) => {
      meCache = null;
      throw err;
    })
    .finally(() => {
      meInFlight = null;
    });

  return meInFlight;
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

export async function fetchLawyerInbox() {
  const res = await authFetch("/lawyer/inbox");
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("fetchLawyerInbox failed:", res.status, txt);
    throw new Error("Failed to load inbox");
  }
  return res.json();
}

export async function fetchNotifications() {
  const res = await authFetch("/notifications");
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("fetchNotifications failed:", res.status, txt);
    throw new Error("Failed to load notifications");
  }
  return res.json();
}

export async function fetchUnreadNotificationCount() {
  const res = await authFetch("/notifications/unread-count");
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("fetchUnreadNotificationCount failed:", res.status, txt);
    throw new Error("Failed to load notification count");
  }
  return res.json();
}

export async function markNotificationRead(notificationId) {
  const res = await authFetch(`/notifications/${notificationId}/read`, {
    method: "PATCH",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("markNotificationRead failed:", res.status, txt);
    throw new Error("Failed to mark notification as read");
  }
  return res.json();
}

export async function markAllNotificationsRead() {
  const res = await authFetch("/notifications/read-all", {
    method: "PATCH",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("markAllNotificationsRead failed:", res.status, txt);
    throw new Error("Failed to mark notifications as read");
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
    credentials: "include",
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

  const data = await res.json();
  if (data?.user) {
    notifyAuthChanged(data.user);
  }
  return data;
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

export async function presignMatterUpload(matterId, fileName, contentType, fileSize) {
  const res = await authFetch(`/matters/${matterId}/uploads/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_name: fileName,
      content_type: contentType,
      file_size: fileSize,
    }),
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

export async function fetchMatterMessages(matterId) {
  const res = await authFetch(`/matters/${matterId}/messages`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("fetchMatterMessages failed:", res.status, txt);
    throw new Error("Failed to load messages");
  }
  return res.json();
}

export async function sendMatterMessage(matterId, body) {
  const res = await authFetch(`/matters/${matterId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("sendMatterMessage failed:", res.status, txt);
    throw new Error("Failed to send message");
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

  const { upload_url, object_key } = await presignMatterUpload(
    matterId,
    fileName,
    contentType,
    file.size
  );

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

  return completeMatterUpload(matterId, fileName, object_key);
}

export async function fetchMatterDetail(matterId) {
  return fetchMatter(matterId);
}
