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
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load matter.");
      } finally {
        if (!cancelled) setLoading(false);
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
        </>
      )}
    </div>
  );
}
