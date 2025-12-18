"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import RequireAuth from "../../components/RequireAuth";
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

function normalizeStatus(s) {
  const val = (s || "").toString().trim();
  if (!val) return "Open";
  return val[0].toUpperCase() + val.slice(1);
}

function fmtDateShort(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function LawyerDashboardPage() {
  const router = useRouter();
  const [checkingRole, setCheckingRole] = useState(true);

  const [matters, setMatters] = useState([]);
  const [mattersLoading, setMattersLoading] = useState(false);
  const [mattersError, setMattersError] = useState(null);

  // create matter modal + fields
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
        const me = await fetchMe();
        if (!me || me.role !== "lawyer") {
          router.push("/portal");
          return;
        }

        // load matters AFTER we know role is lawyer
        setMattersLoading(true);
        setMattersError(null);

        const data = await fetchMyMatters(); // GET /matters (backend filters by role)
        if (!cancelled) setMatters(Array.isArray(data) ? data : []);
      } catch (e) {
        router.push("/portal");
        return;
      } finally {
        if (!cancelled) {
          setMattersLoading(false);
          setCheckingRole(false);
        }
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

    return { total, open };
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

      setMatters((prev) => [created, ...prev]);

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
                    onClick={() => {
                      setCreateError(null);
                      setShowCreate(true);
                    }}
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
              {/* Stats (now real) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat label="Open matters" value={String(stats.open)} sub={`Total: ${stats.total}`} />
                <Stat label="Active clients" value="—" sub="Hook to users table next" />
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
                      onClick={() => {
                        setCreateError(null);
                        setShowCreate(true);
                      }}
                    >
                      Create new
                    </button>
                  </div>

                  {mattersLoading ? (
                    <div className="mt-4 rounded-xl border p-4 text-sm text-slate-600">
                      Loading matters…
                    </div>
                  ) : mattersError ? (
                    <div className="mt-4 rounded-xl border p-4 text-sm text-red-600">
                      {mattersError}
                    </div>
                  ) : matters.length === 0 ? (
                    <div className="mt-4 rounded-xl border p-4 text-sm text-slate-600">
                      No matters yet. Click <span className="font-medium">New matter</span> to create one.
                    </div>
                  ) : (
                    <ul className="mt-4 divide-y">
                      {matters.slice(0, 6).map((m) => (
                        <li key={m.id} className="py-3 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-slate-900">{m.title || `Matter #${m.id}`}</p>
                            <p className="text-xs text-slate-500">
                              #{m.id} • Client {m.client_id ?? "—"} • {m.created_at ? fmtDateShort(m.created_at) : "—"}
                            </p>
                          </div>
                          <span className="rounded-full bg-blue-50 text-blue-700 text-xs px-3 py-1">
                            {normalizeStatus(m.status)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
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
                  Next step: add a file upload endpoint + storage + per-matter foldering.
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
    </RequireAuth>
  );
}