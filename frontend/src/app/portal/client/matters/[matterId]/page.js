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

          {actionError && <p className="mt-4 text-sm text-red-600">{actionError}</p>}
        </>
      )}
    </div>
  );
}
