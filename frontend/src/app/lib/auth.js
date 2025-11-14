// lib/auth.js
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "access_token";

// store token in localStorage (MVP – later we can move to HttpOnly cookies)
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

// Call FastAPI /login, then save token
export async function loginWithEmail(email, password) {
  const res = await fetch(`${API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, password }),
  });

  if (!res.ok) {
    throw new Error("Invalid email or password.");
  }

  const data = await res.json();
  if (!data?.access_token) {
    throw new Error("Login failed: no token returned.");
  }

  saveToken(data.access_token);
  return data.access_token;
}

// Call FastAPI /me (or /profile) to get user + role
export async function fetchMe() {
  const res = await authFetch("/me"); // or "/profile" if that's what you have
  if (!res.ok) {
    throw new Error("Not authenticated");
  }
  return res.json(); // expect { id, email, role } or similar
}

// Call FastAPI /signup to create a new user
export async function signup(name, email, password) {
  const res = await fetch(`${API}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ name, email, password }),
  });

  if (!res.ok) {
    // Try to pull a useful error message
    let msg = "Failed to create account.";
    try {
      const data = await res.json();
      if (data?.detail) msg = data.detail;
    } catch {
      // ignore parse error
    }
    throw new Error(msg);
  }

  return res.json(); // { message, user_id }
}