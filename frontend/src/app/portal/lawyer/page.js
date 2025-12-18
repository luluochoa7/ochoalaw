"use client";

// app/portal/lawyer/page.js
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { fetchMe, fetchMyMatters, createMatter } from "../../lib/auth";

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-xl">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function fmtDateShort(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function normalizeStatus(s) {
  const val = (s || "").toString().trim();
  return val ? val[0].toUpperCase() + val.slice(1) : "Open";
}

export default function LawyerDashboardPage() {
  const router = useRouter();

  const [me, setMe] = useState(null);

  const [matters, setMatters] = useState([]);
  const [loadingMatters, setLoadingMatters] = useState(true);
  const [mattersError, setMattersError] = useState(null);

  // Create Matter modal + form
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [title, setTitle] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function gateAndLoad() {
      try {
        // 1) gate
        const profile = await fetchMe(); // GET /profile
        if (cancelled) return;

        if (!profile?.role) {
          router.push("/portal");
          return;
        }

        if (profile.role !== "lawyer") {
          router.push("/portal/client");
          return;
        }

        setMe(profile);

        // 2) load matters
        setLoadingMatters(true);
        setMattersError(null);

        const data = await fetchMyMatters(); // GET /matters
        if (cancelled) return;

        setMatters(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        if (!cancelled) router.push("/portal"); // not authenticated
      } finally {
        if (!cancelled) setLoadingMatters(false);
      }
    }

    gateAndLoad();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const stats = useMemo(() => {
    const total = matters.length;
    const open = matters.filter((m) => {
      const s = (m.status || "").toLowerCase();
      return s !== "closed" && s !== "complete" && s !== "completed";
    }).length;

    // placeholders until messages/time tracking exist
    return {
      open,
      total,
      activeClients: "—",
      unreadMessages: "—",
      unbilled: "—",
    };
  }, [matters]);

  async function handleCreateMatter(e) {
    e.preventDefault();
    setCreateError(null);

    const t = title.trim();
    const ce = clientEmail.trim().toLowerCase();
    const desc = description.trim();

    if (!t || !ce) {
      setCreateError("Title and client email are required.");
      return;
    }

    setCreateLoading(true);
    try {
      const created = await createMatter({
        title: t,
        client_email: ce,
        description: desc || null,
      });

      // put newest at top
      setMatters((prev) => [created, ...prev]);

      // reset + close
      setTitle("");
      setClientEmail("");
      setDescription("");
      setShowCreate(false);
    } catch (err) {
      console.error(err);
      setCreateError(err?.message || "Failed to create matter.");
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 mt-16">
        {/* Header (same look as your original) */}
        <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-black">
          <div className="container mx-auto px-4 py-12">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white">Firm Dashboard</h1>
                <p className="mt-2 text-blue-100">
                  Track matters, intake, billing, and today’s schedule.
                </p>
                {me?.email && (
                  <p className="mt-2 text-xs text-slate-200/80">Signed in as {me.email}</p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setCreateError(null);
                    setShowCreate(true);
                  }}
                  className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-white hover:bg-white/20"
                >
                  New matter
                </button>
                <button
                  className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-white hover:bg-white/20"
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
            {/* Stats (same visual grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Stat label="Open matters" value={String(stats.open)} sub={`Total: ${stats.total}`} />
              <Stat label="Active clients" value={stats.activeClients} sub="(coming soon)" />
              <Stat label="Unread messages" value={stats.unreadMessages} sub="(coming soon)" />
              <Stat label="Unbilled time" value={stats.unbilled} sub="(coming soon)" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Matters table (same feel as original) */}
              <div className="lg:col-span-2 rounded-2xl bg-white shadow-xl border p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Recent Matters</h2>
                  <button
                    className="text-sm text-blue-700 hover:underline"
                    onClick={() => {
                      setCreateError(null);
                      setShowCreate(true);
                    }}
                  >
                    Create new
                  </button>
                </div>

                <div className="mt-4 overflow-x-auto">
                  {loadingMatters ? (
                    <p className="text-sm text-slate-600">Loading matters…</p>
                  ) : mattersError ? (
                    <p className="text-sm text-red-600">{mattersError}</p>
                  ) : matters.length === 0 ? (
                    <div className="rounded-xl border p-4 text-sm text-slate-600">
                      No matters yet. Click <span className="font-medium">New matter</span> to create one.
                    </div>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead className="text-left text-slate-500">
                        <tr>
                          <th className="py-2 pr-4">Matter</th>
                          <th className="py-2 pr-4">Client</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2">Updated</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {matters.map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50">
                            <td className="py-3 pr-4 font-medium text-slate-900">
                              {m.title || `Matter #${m.id}`}
                              <div className="text-xs text-slate-500 font-normal">
                                #{m.id}
                              </div>
                            </td>
                            <td className="py-3 pr-4">
                              {m.client_id ? `Client ${m.client_id}` : "—"}
                            </td>
                            <td className="py-3 pr-4">
                              <span className="rounded-full bg-blue-50 text-blue-700 text-xs px-2.5 py-1">
                                {normalizeStatus(m.status)}
                              </span>
                            </td>
                            <td className="py-3">
                              {m.created_at ? fmtDateShort(m.created_at) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Today / Inbox (same right column style) */}
              <div className="space-y-6">
                <div className="rounded-2xl bg-white shadow-xl border p-6">
                  <h2 className="text-lg font-semibold text-slate-900">Today</h2>
                  <ul className="mt-4 space-y-3 text-sm">
                    <li className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-slate-900">Schedule</p>
                        <p className="text-slate-600">Appointments coming soon</p>
                      </div>
                      <button
                        className="text-blue-700 hover:underline"
                        onClick={() => alert("Calendar integration coming soon.")}
                      >
                        Open
                      </button>
                    </li>
                    <li className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-slate-900">Tasks</p>
                        <p className="text-slate-600">Matter checklists coming soon</p>
                      </div>
                      <button
                        className="text-blue-700 hover:underline"
                        onClick={() => alert("Task view coming soon.")}
                      >
                        View
                      </button>
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl bg-white shadow-xl border p-6">
                  <h2 className="text-lg font-semibold text-slate-900">Intake & Inbox</h2>
                  <div className="mt-3 space-y-3">
                    <div className="rounded-xl border p-4 hover:bg-slate-50">
                      <p className="text-sm font-medium text-slate-900">Secure messages</p>
                      <p className="text-sm text-slate-600">Coming next (threads per matter)</p>
                    </div>
                    <div className="rounded-xl border p-4 hover:bg-slate-50">
                      <p className="text-sm font-medium text-slate-900">Website intake</p>
                      <p className="text-sm text-slate-600">Coming next (forms → matter)</p>
                    </div>
                  </div>
                  <button
                    className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700"
                    onClick={() => alert("Inbox coming soon.")}
                  >
                    Go to inbox
                  </button>
                </div>
              </div>
            </div>

            {/* Billing row (same style) */}
            <div className="rounded-2xl bg-white shadow-xl border p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Billing Overview</h2>
                <button
                  className="text-sm text-blue-700 hover:underline"
                  onClick={() => alert("Billing coming soon.")}
                >
                  Open billing
                </button>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="rounded-xl border p-4">
                  <p className="text-slate-600">This week</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">—</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-slate-600">Unpaid invoices</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">—</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-slate-600">Pending trust transfers</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">—</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-900 text-slate-300">
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-sm">© {new Date().getFullYear()} Ochoa &amp; Co.</p>
        </div>
      </footer>

      {/* Create Matter Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border p-6 relative">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>

            <h2 className="text-xl font-semibold text-slate-800 text-center">
              Create a new matter
            </h2>
            <p className="mt-2 text-sm text-slate-600 text-center">
              Assign this matter to a client by email.
            </p>

            <form className="mt-5 space-y-4" onSubmit={handleCreateMatter}>
              <div>
                <label className="block text-sm font-medium text-slate-800">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  type="text"
                  required
                  className="mt-2 w-full rounded-lg border-slate-300 px-4 py-3 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                  placeholder="e.g., Lease Review"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-800">Client email</label>
                <input
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  type="email"
                  required
                  className="mt-2 w-full rounded-lg border-slate-300 px-4 py-3 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                  placeholder="client@example.com"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Client must have already signed up (for now).
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-800">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-lg border-slate-300 px-4 py-3 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                  placeholder="Add a short note about the matter…"
                />
              </div>

              {createError && <p className="text-sm text-red-600">{createError}</p>}

              <button
                type="submit"
                disabled={createLoading}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {createLoading ? "Creating…" : "Create matter"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}