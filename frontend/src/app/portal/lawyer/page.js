"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function LawyerDashboardPage() {
  const router = useRouter();

  const [me, setMe] = useState(null);

  const [matters, setMatters] = useState([]);
  const [loadingMatters, setLoadingMatters] = useState(true);
  const [mattersError, setMattersError] = useState(null);

  // Create Matter modal + form state
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [title, setTitle] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [description, setDescription] = useState("");

  // Gate + fetch
  useEffect(() => {
    let cancelled = false;

    async function gateAndLoad() {
      try {
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

        // Load matters
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
    const open = matters.filter((m) => (m.status || "").toLowerCase() !== "closed").length;
    const total = matters.length;
    return { open, total };
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

      // Prepend newest matter in UI
      setMatters((prev) => [created, ...prev]);

      // Reset + close
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-black">
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white">Firm Dashboard</h1>
              <p className="mt-2 text-blue-100">
                Track matters, manage clients, and stay on top of your inbox.
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
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="-mt-8 pb-16">
        <div className="container mx-auto px-4 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Open matters" value={String(stats.open)} sub={`Total: ${stats.total}`} />
            <Stat label="Active clients" value="—" sub="(coming soon)" />
            <Stat label="Unread messages" value="—" sub="(coming soon)" />
            <Stat label="Unbilled time" value="—" sub="(coming soon)" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Matters list */}
            <div className="lg:col-span-2 rounded-2xl bg-white shadow-xl border p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Matters</h2>
                <button
                  onClick={() => {
                    setCreateError(null);
                    setShowCreate(true);
                  }}
                  className="text-sm text-blue-700 hover:underline"
                >
                  Create new
                </button>
              </div>

              <div className="mt-4">
                {loadingMatters ? (
                  <p className="text-sm text-slate-600">Loading matters…</p>
                ) : mattersError ? (
                  <p className="text-sm text-red-600">{mattersError}</p>
                ) : matters.length === 0 ? (
                  <div className="rounded-xl border p-4 text-sm text-slate-600">
                    No matters yet. Create your first matter to get started.
                  </div>
                ) : (
                  <ul className="divide-y">
                    {matters.map((m) => (
                      <li key={m.id} className="py-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">{m.title}</p>
                          <p className="text-xs text-slate-500">
                            Matter #{m.id}
                            {m.client_id ? ` • Client ${m.client_id}` : ""}
                            {m.created_at ? ` • ${fmtDate(m.created_at)}` : ""}
                          </p>
                          {m.description && (
                            <p className="mt-1 text-sm text-slate-600 line-clamp-2">
                              {m.description}
                            </p>
                          )}
                        </div>
                        <span className="rounded-full bg-blue-50 text-blue-700 text-xs px-3 py-1">
                          {m.status || "Open"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Right column: placeholders for next features */}
            <div className="space-y-6">
              <div className="rounded-2xl bg-white shadow-xl border p-6">
                <h2 className="text-lg font-semibold text-slate-900">Today</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Schedule view coming soon (appointments + reminders).
                </p>
              </div>

              <div className="rounded-2xl bg-white shadow-xl border p-6">
                <h2 className="text-lg font-semibold text-slate-900">Inbox</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Secure messaging coming next (threads per matter).
                </p>
              </div>
            </div>
          </div>

          {/* Billing row placeholder */}
          <div className="rounded-2xl bg-white shadow-xl border p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Billing Overview</h2>
              <span className="text-sm text-slate-500">(coming soon)</span>
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