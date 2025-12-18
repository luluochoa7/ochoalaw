// src/lib/auth.js
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:10000";
const TOKEN_KEY = "access_token";

// Store token in localStorage (MVP – later we can move to HttpOnly cookies)
export function saveToken(token) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
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