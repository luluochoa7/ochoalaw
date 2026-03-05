"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchMe,
  fetchMatter,
  fetchMatterDocuments,
  openDocument,
} from "../../../../lib/auth";

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function statusBadgeClass(status) {
  const s = (status || "Open").toString().trim();
  if (s === "Closed") return "bg-red-100 text-red-700";
  if (s === "Waiting on Client") return "bg-amber-100 text-amber-700";
  if (s === "In Progress") return "bg-green-100 text-green-700";
  if (s === "Open") return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-700";
}

export default function ClientMatterDetailPage({ params }) {
  const router = useRouter();
  const { matterId } = params;

  const [matter, setMatter] = useState(null);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [actionError, setActionError] = useState("");

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

  async function handleOpenDocument(documentId) {
    setActionError("");
    try {
      await openDocument(documentId);
    } catch (e) {
      setActionError(e?.message || "Could not open document.");
    }
  }

  return (
    <>
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-black">
        <div className="container mx-auto px-4 py-10">
          <h1 className="text-2xl md:text-3xl font-bold text-white">Matter Workspace</h1>
          <p className="mt-2 text-blue-100">
            View details, status, and documents in one place.
          </p>
        </div>
      </section>

      <section className="-mt-8 pb-16">
        <div className="container mx-auto px-4">
          <div className="rounded-2xl bg-white border shadow-xl p-6 md:p-8">
            {loading ? (
              <p className="text-sm text-slate-600">Loading matter workspace…</p>
            ) : err ? (
              <p className="text-sm text-red-600">{err}</p>
            ) : (
              <div className="space-y-6">
                <Link href="/portal/client" className="inline-block text-sm text-blue-700 hover:underline">
                  ← Back to dashboard
                </Link>

                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-bold text-slate-900 break-words">
                      {matter?.title}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500 whitespace-normal break-words">
                      Matter #{matter?.id} • Created {formatDateTime(matter?.created_at)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(
                      matter?.status
                    )}`}
                  >
                    {matter?.status || "Open"}
                  </span>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="rounded-2xl border bg-slate-50 p-6 lg:col-span-2">
                    <h3 className="text-lg font-semibold text-slate-900">Matter Details</h3>
                    <p className="mt-4 text-sm text-slate-700 whitespace-pre-wrap break-words overflow-hidden">
                      {matter?.description || "No description provided yet."}
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-white p-6">
                    <h3 className="text-lg font-semibold text-slate-900">Documents</h3>
                    <ul className="mt-3 divide-y rounded-xl border max-h-[420px] overflow-y-auto bg-white">
                      {docs.length ? (
                        docs.map((d) => (
                          <li key={d.id} className="p-3 flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {d.filename}
                              </p>
                              <p className="text-xs text-slate-500 whitespace-normal break-words">
                                Uploaded {formatDateTime(d.created_at)}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white hover:bg-black"
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

                {actionError && <p className="text-sm text-red-600">{actionError}</p>}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
