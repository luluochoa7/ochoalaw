"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchMe,
  fetchMatter,
  fetchMatterDocuments,
  openDocument,
  updateMatter,
  fetchInternalNotes,
  createInternalNote,
  fetchSharedUpdates,
  createSharedUpdate,
} from "../../../../lib/auth";

const STATUS_OPTIONS = ["Open", "In Progress", "Waiting on Client", "Closed"];

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function LawyerMatterDetailPage({ params }) {
  const router = useRouter();
  const { matterId } = params;

  const [matter, setMatter] = useState(null);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [descriptionSaving, setDescriptionSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [internalNotes, setInternalNotes] = useState([]);
  const [internalNotesLoading, setInternalNotesLoading] = useState(true);
  const [internalNoteContent, setInternalNoteContent] = useState("");
  const [internalNoteBusy, setInternalNoteBusy] = useState(false);
  const [internalNotesError, setInternalNotesError] = useState("");
  const [sharedUpdates, setSharedUpdates] = useState([]);
  const [sharedUpdatesLoading, setSharedUpdatesLoading] = useState(true);
  const [sharedUpdateContent, setSharedUpdateContent] = useState("");
  const [sharedUpdateBusy, setSharedUpdateBusy] = useState(false);
  const [sharedUpdatesError, setSharedUpdatesError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const me = await fetchMe();
        if (!me || me.role !== "lawyer") {
          router.push("/portal");
          return;
        }

        const [matterData, documents] = await Promise.all([
          fetchMatter(matterId),
          fetchMatterDocuments(matterId),
        ]);

        if (!cancelled) {
          setMatter(matterData ?? null);
          setDescriptionDraft(matterData?.description || "");
          setDocs(Array.isArray(documents) ? documents : []);
        }

        try {
          const internal = await fetchInternalNotes(matterId);
          if (!cancelled) setInternalNotes(Array.isArray(internal) ? internal : []);
        } catch (e) {
          if (!cancelled) {
            setInternalNotesError(e?.message || "Failed to load internal notes.");
            setInternalNotes([]);
          }
        } finally {
          if (!cancelled) setInternalNotesLoading(false);
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
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load matter.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setInternalNotesLoading(false);
          setSharedUpdatesLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [matterId, router]);

  async function handleStatusChange(nextStatus) {
    if (!matter) return;
    setActionError("");
    setActionSuccess("");
    setStatusSaving(true);
    try {
      const updated = await updateMatter(matterId, { status: nextStatus });
      setMatter(updated);
      setActionSuccess("Status updated.");
    } catch (e) {
      setActionError(e?.message || "Failed to update status.");
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleDescriptionSave() {
    setActionError("");
    setActionSuccess("");
    setDescriptionSaving(true);
    try {
      const updated = await updateMatter(matterId, { description: descriptionDraft });
      setMatter(updated);
      setDescriptionDraft(updated?.description || "");
      setActionSuccess("Description updated.");
    } catch (e) {
      setActionError(e?.message || "Failed to update description.");
    } finally {
      setDescriptionSaving(false);
    }
  }

  async function handleOpenDocument(documentId) {
    setActionError("");
    try {
      await openDocument(documentId);
    } catch (e) {
      setActionError(e?.message || "Could not open document.");
    }
  }

  async function handleCreateInternalNote(e) {
    e.preventDefault();
    setInternalNotesError("");

    const content = internalNoteContent.trim();
    if (!content) {
      setInternalNotesError("Please enter a note.");
      return;
    }

    setInternalNoteBusy(true);
    try {
      const created = await createInternalNote(matterId, content);
      setInternalNotes((prev) => [created, ...prev]);
      setInternalNoteContent("");
    } catch (e) {
      setInternalNotesError(e?.message || "Failed to create internal note.");
    } finally {
      setInternalNoteBusy(false);
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
          <Link href="/portal/lawyer" className="text-sm text-blue-700 hover:underline">
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
              <h2 className="text-lg font-semibold text-slate-900">Matter Workspace</h2>

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-800">Status</label>
                <select
                  value={matter?.status || "Open"}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={statusSaving}
                  className="mt-2 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-5">
                <label className="block text-sm font-medium text-slate-800">
                  Description
                </label>
                <textarea
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  rows={6}
                  className="mt-2 w-full rounded-lg border-slate-300 px-4 py-3 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                  placeholder="Add details for this matter..."
                />
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleDescriptionSave}
                    disabled={descriptionSaving}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
                  >
                    {descriptionSaving ? "Saving..." : "Save description"}
                  </button>
                </div>
              </div>

              {actionError && <p className="mt-4 text-sm text-red-600">{actionError}</p>}
              {actionSuccess && <p className="mt-4 text-sm text-green-600">{actionSuccess}</p>}
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
            <h2 className="text-lg font-semibold text-slate-900">Internal Notes</h2>
            <p className="mt-2 text-sm text-slate-600">
              Private notes visible only to the lawyer.
            </p>

            <form className="mt-4 space-y-3" onSubmit={handleCreateInternalNote}>
              <textarea
                value={internalNoteContent}
                onChange={(e) => setInternalNoteContent(e.target.value)}
                rows={4}
                className="w-full resize-y rounded-lg border-slate-300 px-4 py-3 shadow-sm focus:border-blue-600 focus:ring-blue-600 min-h-[120px]"
                placeholder="Add a private internal note..."
              />

              {internalNotesError && (
                <p className="text-sm text-red-600">{internalNotesError}</p>
              )}

              <button
                type="submit"
                disabled={internalNoteBusy}
                className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-black disabled:opacity-60"
              >
                {internalNoteBusy ? "Saving..." : "Add Internal Note"}
              </button>
            </form>

            <div className="mt-6">
              {internalNotesLoading ? (
                <p className="text-sm text-slate-600">Loading internal notes...</p>
              ) : internalNotes.length ? (
                <ul className="space-y-3">
                  {internalNotes.map((n) => (
                    <li key={n.id} className="rounded-xl border bg-slate-50 p-4">
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
                <p className="text-sm text-slate-500">No internal notes yet.</p>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-white border shadow-xl p-6">
            <h2 className="text-lg font-semibold text-slate-900">Shared Updates</h2>
            <p className="mt-2 text-sm text-slate-600">
              Visible to both lawyer and client for matter related updates.
            </p>

            <form className="mt-4 space-y-3" onSubmit={handleCreateSharedUpdate}>
              <textarea
                value={sharedUpdateContent}
                onChange={(e) => setSharedUpdateContent(e.target.value)}
                rows={4}
                className="w-full resize-y rounded-lg border-slate-300 px-4 py-3 shadow-sm focus:border-blue-600 focus:ring-blue-600 min-h-[120px]"
                placeholder="Add a shared update..."
              />

              {sharedUpdatesError && (
                <p className="text-sm text-red-600">{sharedUpdatesError}</p>
              )}

              <button
                type="submit"
                disabled={sharedUpdateBusy}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {sharedUpdateBusy ? "Saving..." : "Add Shared Update"}
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
        </>
      )}
    </div>
  );
}
