"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  acceptInvitation,
  fetchInvitation,
  notifyAuthChanged,
  saveToken,
} from "../../lib/auth";

function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = (searchParams.get("token") || "").trim();

  const [inviteLoading, setInviteLoading] = useState(true);
  const [inviteError, setInviteError] = useState("");
  const [invite, setInvite] = useState(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadInvite() {
      if (!token) {
        setInviteError("Missing invitation token.");
        setInviteLoading(false);
        return;
      }

      setInviteLoading(true);
      setInviteError("");
      try {
        const data = await fetchInvitation(token);
        if (!cancelled) {
          setInvite(data ?? null);
        }
      } catch (e) {
        if (!cancelled) {
          setInvite(null);
          setInviteError(e?.message || "Invitation is invalid or expired.");
        }
      } finally {
        if (!cancelled) setInviteLoading(false);
      }
    }

    loadInvite();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleAcceptInvite(e) {
    e.preventDefault();
    setSubmitError("");

    const pw = password.trim();
    const confirm = confirmPassword.trim();

    if (!pw) {
      setSubmitError("Password is required.");
      return;
    }

    if (pw.length < 8) {
      setSubmitError("Password must be at least 8 characters.");
      return;
    }

    if (pw !== confirm) {
      setSubmitError("Passwords do not match.");
      return;
    }

    setSubmitLoading(true);
    try {
      const data = await acceptInvitation(token, pw);
      if (!data?.access_token) {
        throw new Error("Invitation accepted but no access token was returned.");
      }

      saveToken(data.access_token);
      notifyAuthChanged(data?.user || null);
      router.push("/portal/client");
    } catch (e) {
      setSubmitError(e?.message || "Failed to accept invitation.");
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 mt-16">
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-black">
        <div className="container mx-auto px-4 py-14 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white">Client Invitation</h1>
          <p className="mt-3 text-blue-100">
            Set your password to access your secure client portal.
          </p>
        </div>
      </section>

      <section className="-mt-10 pb-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-lg rounded-2xl bg-white shadow-xl border p-8">
            {inviteLoading ? (
              <p className="text-sm text-slate-600">Loading invitation...</p>
            ) : inviteError ? (
              <p className="text-sm text-red-600">{inviteError}</p>
            ) : (
              <>
                <div className="rounded-xl border bg-slate-50 p-4">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium text-slate-900">Name:</span> {invite?.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    <span className="font-medium text-slate-900">Email:</span> {invite?.email}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Expires: {fmtDateTime(invite?.expires_at)}
                  </p>
                </div>

                <form className="mt-6 space-y-4" onSubmit={handleAcceptInvite}>
                  <div>
                    <label
                      htmlFor="invite-password"
                      className="block text-sm font-medium text-slate-800"
                    >
                      Password
                    </label>
                    <input
                      id="invite-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="mt-2 w-full rounded-lg border-slate-300 px-4 py-3 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                      placeholder="Choose a secure password"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="invite-password-confirm"
                      className="block text-sm font-medium text-slate-800"
                    >
                      Confirm password
                    </label>
                    <input
                      id="invite-password-confirm"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="mt-2 w-full rounded-lg border-slate-300 px-4 py-3 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                      placeholder="Re-enter your password"
                    />
                  </div>

                  {submitError && <p className="text-sm text-red-600">{submitError}</p>}

                  <button
                    type="submit"
                    disabled={submitLoading}
                    className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {submitLoading ? "Creating account..." : "Accept invitation"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
