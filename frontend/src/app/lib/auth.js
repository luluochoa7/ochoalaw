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

export async function getDocumentDownloadUrl(documentId) {
  const res = await authFetch(`/documents/${documentId}/download`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("getDocumentDownloadUrl failed:", res.status, txt);
    throw new Error("Failed to get download link.");
  }
  const data = await res.json();
  return data.download_url;
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

/**
 * Convenience helper:
 * Gets a presigned GET link and opens the document in a new tab.
 */
export async function openDocument(documentId) {
  const url = await getDocumentDownloadUrl(documentId);

  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return url;
}

export async function fetchMatterDetail(matterId) {
  const res = await authFetch(`/matters/${matterId}`);
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error("You do not have access to this matter.");
    }
    if (res.status === 404) {
      throw new Error("Matter not found.");
    }
    const txt = await res.text().catch(() => "");
    console.error("fetchMatterDetail failed:", res.status, txt);
    throw new Error("Failed to load matter.");
  }
  return res.json();
}
