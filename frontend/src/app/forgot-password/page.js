"use client";

import Link from "next/link";
import { useState } from "react";
import { requestPasswordReset } from "../lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSuccess("");
    setError("");

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("Email is required.");
      return;
    }

    setLoading(true);
    try {
      const result = await requestPasswordReset(normalizedEmail);
      setSuccess(
        result?.message || "If that email exists, a reset link has been sent."
      );
    } catch (err) {
      setError(err?.message || "Failed to request password reset.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 mt-16">
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-black">
        <div className="container mx-auto px-4 py-14 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white">Forgot Password</h1>
          <p className="mt-3 text-blue-100">
            Enter your email and we will send you a reset link.
          </p>
        </div>
      </section>

      <section className="-mt-10 pb-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-lg rounded-2xl bg-white shadow-xl border p-8">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="forgot-email"
                  className="block text-sm font-medium text-slate-800"
                >
                  Email
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 w-full rounded-lg border-slate-300 px-4 py-3 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                  placeholder="you@example.com"
                />
              </div>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {success ? <p className="text-sm text-green-600">{success}</p> : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link href="/portal" className="text-sm text-blue-700 hover:underline">
                Back to login
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
