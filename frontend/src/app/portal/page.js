// app/portal/page.js
import Navbar from "../components/Navbar";
import RoleSelector from "./RoleSelector";

export default function PortalPage({ searchParams }) {
  const roleParam = (searchParams?.role || "").toString().toLowerCase();
  const initialRole = roleParam === "lawyer" ? "lawyer" : "client";

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 mt-16">
        {/* Header */}
        <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-black">
          <div className="container mx-auto px-4 py-14 text-center">
            <h1 className="text-4xl font-bold text-white">Secure Portal Login</h1>
            <p className="mt-3 text-blue-100">Sign in to access your dashboard.</p>
          </div>
        </section>

        {/* Auth card */}
        <section className="-mt-10 pb-16">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-lg rounded-2xl bg-white shadow-xl border p-8">
              {/* Role selector (client) */}
              <RoleSelector initialRole={initialRole} />

              {/* Login form (placeholder) */}
              <form className="mt-6 space-y-4" /* action="/api/auth/login" method="POST" (later) */>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-800">
                    Email
                  </label>
                  <input
                    id="email"
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
                    type="password"
                    required
                    className="mt-2 w-full rounded-lg border-slate-300 px-4 py-3 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                    placeholder="Your password"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700"
                  title="This is a placeholder. Hook up auth later."
                >
                  Sign In
                </button>

                <p className="text-xs text-slate-500 text-center">
                  You’ll be routed to your dashboard after login.
                </p>
              </form>

              <div className="mt-6 flex items-center justify-between text-sm">
                <a className="text-slate-700 hover:text-slate-900" href="#">
                  Forgot password?
                </a>
                <a className="text-slate-700 hover:text-slate-900" href="#">
                  Create account
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-900 text-slate-300">
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-sm">© {new Date().getFullYear()} Ochoa &amp; Co. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}