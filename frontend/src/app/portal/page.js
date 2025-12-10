// src/app/portal/page.js
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginWithEmail, fetchMe, signup } from "../lib/auth";

export default function PortalPage() {
  const router = useRouter();

  // login state
  const [loginError, setLoginError] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // signup modal state
  const [showSignup, setShowSignup] = useState(false);
  const [signupError, setSignupError] = useState(null);
  const [signupLoading, setSignupLoading] = useState(false);

  async function handleLoginSubmit(e) {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    try {
      if (!email || !password) {
        throw new Error("Email and password are required.");
      }

      // 1) login
      await loginWithEmail(email, password);

      // 2) fetch me
      const me = await fetchMe();

      // 3) redirect
      if (me.role === "lawyer") {
        router.push("/portal/lawyer");
      } else {
        router.push("/portal/client");
      }
    } catch (err) {
      console.error(err);
      setLoginError(err.message || "Login failed.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleSignupSubmit(e) {
    e.preventDefault();
    setSignupError(null);
    setSignupLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    try {
      if (!name || !email || !password) {
        throw new Error("Name, email, and password are required.");
      }

      // 1) create user in DB
      await signup(name, email, password);

      // 2) log in immediately with same credentials
      await loginWithEmail(email, password);

      // 3) fetch /me to get role
      const me = await fetchMe();

      // 4) close modal
      setShowSignup(false);

      // 5) redirect
      if (me.role === "lawyer") {
        router.push("/portal/lawyer");
      } else {
        router.push("/portal/client");
      }
    } catch (err) {
      console.error(err);
      setSignupError(err.message || "Could not create account.");
    } finally {
      setSignupLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      <main className="flex-1 mt-16">
        {/* Header */}
        <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-black">
          <div className="container mx-auto px-4 py-14 text-center">
            <h1 className="text-4xl font-bold text-white">Secure Portal Access</h1>
            <p className="mt-3 text-blue-100">
              Sign in or create an account to access your secure portal.
            </p>
          </div>
        </section>

        {/* Auth card */}
        <section className="-mt-10 pb-16">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-lg rounded-2xl bg-white shadow-xl border p-8">
              <h2 className="text-xl font-semibold text-slate-800 text-center">
                Sign in to your account
              </h2>

              <form className="mt-6 space-y-4" onSubmit={handleLoginSubmit}>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-800">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="mt-2 w-full rounded-lg border-slate-300 px-4 py-3 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-800">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className="mt-2 w-full rounded-lg border-slate-300 px-4 py-3 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                    placeholder="Your password"
                  />
                </div>

                {loginError && (
                  <p className="text-sm text-red-600">
                    {loginError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {loginLoading ? "Signing in..." : "Sign In"}
                </button>
              </form>

              {/* footer links */}
              <div className="mt-6 flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="text-slate-700 hover:text-slate-900"
                  onClick={() => alert("Password reset flow coming soon.")}
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  className="text-slate-700 hover:text-slate-900 font-medium"
                  onClick={() => {
                    setSignupError(null);
                    setShowSignup(true);
                  }}
                >
                  Create account
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Signup Modal */}
      {showSignup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border p-6 relative">
            <button
              type="button"
              onClick={() => setShowSignup(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>

            <h2 className="text-xl font-semibold text-slate-800 text-center">
              Create a new account
            </h2>
            <p className="mt-2 text-sm text-slate-600 text-center">
              Enter your details to create a secure portal account.
            </p>

            <form className="mt-5 space-y-4" onSubmit={handleSignupSubmit}>
              <div>
                <label htmlFor="signup-name" className="block text-sm font-medium text-slate-800">
                  Full Name
                </label>
                <input
                  id="signup-name"
                  name="name"
                  type="text"
                  required
                  className="mt-2 w-full rounded-lg border-slate-300 px-4 py-3 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label htmlFor="signup-email" className="block text-sm font-medium text-slate-800">
                  Email
                </label>
                <input
                  id="signup-email"
                  name="email"
                  type="email"
                  required
                  className="mt-2 w-full rounded-lg border-slate-300 px-4 py-3 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="signup-password" className="block text-sm font-medium text-slate-800">
                  Password
                </label>
                <input
                  id="signup-password"
                  name="password"
                  type="password"
                  required
                  className="mt-2 w-full rounded-lg border-slate-300 px-4 py-3 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                  placeholder="Choose a secure password"
                />
              </div>

              {signupError && (
                <p className="text-sm text-red-600">{signupError}</p>
              )}

              <button
                type="submit"
                disabled={signupLoading}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {signupLoading ? "Creating account..." : "Create Account"}
              </button>
            </form>

            <p className="mt-4 text-xs text-slate-500 text-center">
              By creating an account, you agree to our terms of use and privacy policy.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}