"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchMe,
  fetchMatter,
  fetchMatterDocuments,
  openDocument,
  fetchSharedUpdates,
  createSharedUpdate,
  fetchMatterEvents,
} from "../../../../lib/auth";

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function ClientMatterDetailPage({ params }) {
  const router = useRouter();
  const { matterId } = params;

  const [matter, setMatter] = useState(null);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [actionError, setActionError] = useState("");
  const [sharedUpdates, setSharedUpdates] = useState([]);
  const [sharedUpdatesLoading, setSharedUpdatesLoading] = useState(true);
  const [sharedUpdateContent, setSharedUpdateContent] = useState("");
  const [sharedUpdateBusy, setSharedUpdateBusy] = useState(false);
  const [sharedUpdatesError, setSharedUpdatesError] = useState("");
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState("");

  async function refreshEvents() {
    try {
      const eventList = await fetchMatterEvents(matterId);
      setEvents(Array.isArray(eventList) ? eventList : []);
      setEventsError("");
    } catch (e) {
      setEventsError(e?.message || "Failed to load activity.");
    } finally {
      setEventsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const me = await fetchMe();
        if (!me || me.role !== "client") {
          router.push("/portal");
          return;
        }

        const [matterData, documents] = await Promise.all([
          fetchMatter(matterId),
          fetchMatterDocuments(matterId),
        ]);

        if (!cancelled) {
          setMatter(matterData ?? null);
          setDocs(Array.isArray(documents) ? documents : []);
        }

        try {
          const shared = await fetchSharedUpdates(matterId);
          if (!cancelled) setSharedUpdates(Array.isArray(shared) ? shared : []);
        } catch (e) {
          if (!cancelled) {
            setSharedUpdatesError(e?.message || "Failed to load shared updates.");
            setSharedUpdates([]);
          }
        } finally {
          if (!cancelled) setSharedUpdatesLoading(false);
        }

        try {
          const eventList = await fetchMatterEvents(matterId);
          if (!cancelled) {
            setEvents(Array.isArray(eventList) ? eventList : []);
            setEventsError("");
          }
        } catch (e) {
          if (!cancelled) setEventsError(e?.message || "Failed to load activity.");
        } finally {
          if (!cancelled) setEventsLoading(false);
        }
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load matter.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setSharedUpdatesLoading(false);
          setEventsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [matterId, router]);

  async function handleOpenDocument(documentId) {
    setActionError("");
    try {
      await openDocument(documentId);
    } catch (e) {
      setActionError(e?.message || "Could not open document.");
    }
  }

  async function handleCreateSharedUpdate(e) {
    e.preventDefault();
    setSharedUpdatesError("");

    const content = sharedUpdateContent.trim();
    if (!content) {
      setSharedUpdatesError("Please enter an update.");
      return;
    }

    setSharedUpdateBusy(true);
    try {
      const created = await createSharedUpdate(matterId, content);
      setSharedUpdates((prev) => [created, ...prev]);
      setSharedUpdateContent("");
      await refreshEvents();
    } catch (e) {
      setSharedUpdatesError(e?.message || "Failed to create shared update.");
    } finally {
      setSharedUpdateBusy(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-10">
      {loading ? (
        <p className="text-sm text-slate-600">Loading…</p>
      ) : err ? (
        <p className="text-sm text-red-600">{err}</p>
      ) : (
        <>
          <Link href="/portal/client" className="text-sm text-blue-700 hover:underline">
            ← Back to dashboard
          </Link>

          <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{matter?.title}</h1>
              <p className="mt-1 text-xs text-slate-500">
                Matter #{matter?.id} • Created {formatDateTime(matter?.created_at)}
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
              {matter?.status || "Open"}
            </span>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl bg-white border shadow-xl p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold text-slate-900">Matter Details</h2>
              <p className="mt-4 text-sm text-slate-700 whitespace-pre-wrap">
                {matter?.description || "No description provided yet."}
              </p>
            </div>

            <div className="rounded-2xl bg-white border shadow-xl p-6">
              <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
              <ul className="mt-3 divide-y rounded-xl border max-h-[420px] overflow-y-auto">
                {docs.length ? (
                  docs.map((d) => (
                    <li key={d.id} className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {d.filename}
                        </p>
                        <p className="text-xs text-slate-500">
                          Uploaded {formatDateTime(d.created_at)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white hover:bg-black"
                        onClick={() => handleOpenDocument(d.id)}
                      >
                        Open
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="p-3 text-sm text-slate-600">No documents yet.</li>
                )}
              </ul>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-white border shadow-xl p-6">
            <h2 className="text-lg font-semibold text-slate-900">Shared Updates</h2>
            <p className="mt-2 text-sm text-slate-600">
              Updates shared between you and your lawyer for this matter.
            </p>

            <form className="mt-4 space-y-3" onSubmit={handleCreateSharedUpdate}>
              <textarea
                value={sharedUpdateContent}
                onChange={(e) => setSharedUpdateContent(e.target.value)}
                rows={4}
                className="w-full resize-y rounded-lg border-slate-300 px-4 py-3 shadow-sm focus:border-blue-600 focus:ring-blue-600 min-h-[120px]"
                placeholder="Add an update or response..."
              />

              {sharedUpdatesError && (
                <p className="text-sm text-red-600">{sharedUpdatesError}</p>
              )}

              <button
                type="submit"
                disabled={sharedUpdateBusy}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {sharedUpdateBusy ? "Saving..." : "Add Update"}
              </button>
            </form>

            <div className="mt-6">
              {sharedUpdatesLoading ? (
                <p className="text-sm text-slate-600">Loading shared updates...</p>
              ) : sharedUpdates.length ? (
                <ul className="space-y-3">
                  {sharedUpdates.map((n) => (
                    <li key={n.id} className="rounded-xl border bg-blue-50 p-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-sm font-medium text-slate-900">
                          {n.user_name || `User ${n.user_id}`}
                        </p>
                        <p className="text-xs text-slate-500">
                          {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                        </p>
                      </div>
                      <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap break-words">
                        {n.content}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No shared updates yet.</p>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-white border shadow-xl p-6">
            <h2 className="text-lg font-semibold text-slate-900">Activity</h2>
            <p className="mt-2 text-sm text-slate-600">
              Timeline of activity for this matter.
            </p>

            <div className="mt-6">
              {eventsLoading ? (
                <p className="text-sm text-slate-600">Loading activity...</p>
              ) : eventsError ? (
                <p className="text-sm text-red-600">{eventsError}</p>
              ) : events.length ? (
                <ul className="space-y-3">
                  {events.map((ev) => (
                    <li key={ev.id} className="rounded-xl border bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-sm font-medium text-slate-900">
                          {ev.message}
                        </p>
                        <p className="text-xs text-slate-500">
                          {ev.created_at ? new Date(ev.created_at).toLocaleString() : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No activity yet.</p>
              )}
            </div>
          </div>

          {actionError && <p className="mt-4 text-sm text-red-600">{actionError}</p>}
        </>
      )}
    </div>
  );
}
