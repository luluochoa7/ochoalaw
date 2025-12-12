"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import RequireAuth from "../../components/RequireAuth";
import { fetchMe } from "../../lib/auth";

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-xl">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function LawyerDashboardPage() {
  const router = useRouter();
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function gate() {
      try {
        const me = await fetchMe();
        if (!me || me.role !== "lawyer") {
          router.push("/portal");
          return;
        }
      } catch (e) {
        router.push("/portal");
        return;
      } finally {
        if (!cancelled) setCheckingRole(false);
      }
    }

    gate();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checkingRole) {
    return <div className="mt-24 text-center">Loading your dashboard...</div>;
  }

  return (
    <RequireAuth>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />

        <main className="flex-1 mt-16">
          {/* Header */}
          <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-black">
            <div className="container mx-auto px-4 py-12">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-white">Firm Dashboard</h1>
                  <p className="mt-2 text-blue-100">
                    Track matters, intake, billing, and today’s schedule.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-white hover:bg-white/20"
                    type="button"
                    onClick={() => alert("Create matter flow coming soon.")}
                  >
                    New matter
                  </button>
                  <button
                    className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-white hover:bg-white/20"
                    type="button"
                    onClick={() => alert("Invite client flow coming soon.")}
                  >
                    Invite client
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Content */}
          <section className="-mt-8 pb-16">
            <div className="container mx-auto px-4 space-y-6">
              {/* Stats (placeholder for now) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat label="Open matters" value="—" sub="Hook to /lawyer/matters next" />
                <Stat label="Active clients" value="—" sub="Hook to users table" />
                <Stat label="Unread messages" value="—" sub="Messaging coming soon" />
                <Stat label="Unbilled time" value="—" sub="Time tracking coming soon" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Matters */}
                <div className="lg:col-span-2 rounded-2xl bg-white shadow-xl border p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">Recent Matters</h2>
                    <button
                      className="text-sm text-blue-700 hover:underline"
                      type="button"
                      onClick={() => alert("Lawyer matters list coming soon.")}
                    >
                      View all
                    </button>
                  </div>

                  <div className="mt-4 rounded-xl border p-4 text-sm text-slate-600">
                    Next step: wire this to a `GET /lawyer/matters` endpoint filtered by the
                    logged-in lawyer.
                  </div>
                </div>

                {/* Right rail */}
                <div className="space-y-6">
                  <div className="rounded-2xl bg-white shadow-xl border p-6">
                    <h2 className="text-lg font-semibold text-slate-900">Today</h2>
                    <p className="mt-3 text-sm text-slate-600">
                      Calendar/scheduling integration coming soon.
                    </p>
                    <button
                      className="mt-4 w-full rounded-lg bg-slate-900 text-white px-4 py-3 text-sm opacity-60 cursor-not-allowed"
                      type="button"
                      disabled
                    >
                      Scheduling coming soon
                    </button>
                  </div>

                  <div className="rounded-2xl bg-white shadow-xl border p-6">
                    <h2 className="text-lg font-semibold text-slate-900">Intake & Inbox</h2>
                    <p className="mt-3 text-sm text-slate-600">
                      Next step: show new contact submissions + client messages.
                    </p>
                    <button
                      className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700"
                      type="button"
                      onClick={() => alert("Inbox coming soon.")}
                    >
                      Go to inbox
                    </button>
                  </div>
                </div>
              </div>

              {/* Uploads (placeholder) */}
              <div className="rounded-2xl bg-white shadow-xl border p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
                  <button
                    className="text-sm text-blue-700 hover:underline"
                    type="button"
                    onClick={() => alert("Document center coming soon.")}
                  >
                    Open
                  </button>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  Next step: add a file upload endpoint + S3/Supabase storage + per-matter foldering.
                </p>
              </div>
            </div>
          </section>
        </main>

        <footer className="bg-slate-900 text-slate-300">
          <div className="container mx-auto px-4 py-8 text-center">
            <p className="text-sm">© {new Date().getFullYear()} Ochoa &amp; Co.</p>
          </div>
        </footer>
      </div>
    </RequireAuth>
  );
}