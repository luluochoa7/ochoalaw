"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  confirmPasswordReset,
  fetchPasswordResetToken,
} from "../lib/auth";

function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = (searchParams.get("token") || "").trim();

  const [tokenInfo, setTokenInfo] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [tokenError, setTokenError] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [resetComplete, setResetComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadToken() {
      if (!token) {
        setTokenError("Missing reset token.");
        setTokenLoading(false);
        return;
      }

      setTokenLoading(true);
      setTokenError("");
      try {
        const data = await fetchPasswordResetToken(token);
        if (!cancelled) setTokenInfo(data ?? null);
      } catch (err) {
        if (!cancelled) {
          setTokenInfo(null);
          setTokenError(err?.message || "Reset link is invalid or expired.");
        }
      } finally {
        if (!cancelled) setTokenLoading(false);
      }
    }

    loadToken();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError("");
    setSubmitSuccess("");
    setResetComplete(false);

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
      const result = await confirmPasswordReset(token, pw);
      setSubmitSuccess(result?.message || "Password reset successful.");
      setPassword("");
      setConfirmPassword("");
      setResetComplete(true);
    } catch (err) {
      setSubmitError(err?.message || "Failed to reset password.");
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 mt-16">
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-black">
        <div className="container mx-auto px-4 py-14 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white">Reset Password</h1>
          <p className="mt-3 text-blue-100">
            Set a new password for your portal account.
          </p>
        </div>
      </section>

      <section className="-mt-10 pb-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-lg rounded-2xl bg-white shadow-xl border p-8">
            {tokenLoading ? (
              <p className="text-sm text-slate-600">Validating reset link...</p>
            ) : tokenError ? (
              <div className="space-y-4">
                <p className="text-sm text-red-600">{tokenError}</p>
                <Link href="/forgot-password" className="text-sm text-blue-700 hover:underline">
                  Request a new reset link
                </Link>
              </div>
            ) : (
              <>
                {!resetComplete ? (
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <p className="text-sm text-slate-700">
                      <span className="font-medium text-slate-900">Email:</span>{" "}
                      {tokenInfo?.email || "—"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Expires: {fmtDateTime(tokenInfo?.expires_at)}
                    </p>
                  </div>
                ) : null}

                {resetComplete ? (
                  <div className="mt-6 space-y-4">
                    <p className="text-sm text-green-600">
                      {submitSuccess || "Your password has been reset successfully."}
                    </p>
                    <button
                      type="button"
                      onClick={() => router.push("/portal")}
                      className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700"
                    >
                      Back to login
                    </button>
                  </div>
                ) : (
                  <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                    <div>
                      <label
                        htmlFor="reset-password"
                        className="block text-sm font-medium text-slate-800"
                      >
                        New password
                      </label>
                      <input
                        id="reset-password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="mt-2 w-full rounded-lg border-slate-300 px-4 py-3 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                        placeholder="Choose a secure password"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="reset-password-confirm"
                        className="block text-sm font-medium text-slate-800"
                      >
                        Confirm new password
                      </label>
                      <input
                        id="reset-password-confirm"
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="mt-2 w-full rounded-lg border-slate-300 px-4 py-3 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                        placeholder="Re-enter your new password"
                      />
                    </div>

                    {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

                    <button
                      type="submit"
                      disabled={submitLoading}
                      className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {submitLoading ? "Resetting..." : "Reset password"}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function ResetPasswordFallback() {
  return (
    <main className="min-h-screen bg-gray-50 mt-16">
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-black">
        <div className="container mx-auto px-4 py-14 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white">Reset Password</h1>
          <p className="mt-3 text-blue-100">Set a new password for your portal account.</p>
        </div>
      </section>
      <section className="-mt-10 pb-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-lg rounded-2xl bg-white shadow-xl border p-8">
            <p className="text-sm text-slate-600">Loading reset form...</p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
