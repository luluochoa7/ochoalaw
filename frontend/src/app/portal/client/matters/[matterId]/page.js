"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchMatterDetail, openDocument } from "../../../../lib/auth";

export default function ClientMatterDetailPage({ params }) {
  const { matterId } = params;

  const [matter, setMatter] = useState(null);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchMatterDetail(matterId);
        if (!cancelled) {
          setMatter(data?.matter ?? null);
          setDocs(Array.isArray(data?.documents) ? data.documents : []);
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
  }, [matterId]);

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

          <h1 className="mt-4 text-2xl font-bold text-slate-900">{matter?.title}</h1>
          <p className="mt-2 text-sm text-slate-600">{matter?.description || "No description."}</p>

          <div className="mt-8 rounded-2xl bg-white border shadow-xl p-6">
            <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
            <ul className="mt-3 divide-y rounded-xl border">
              {docs.length ? (
                docs.map((d) => (
                  <li key={d.id} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{d.filename}</p>
                      <p className="text-xs text-slate-500">Doc #{d.id}</p>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white hover:bg-black"
                      onClick={() => openDocument(d.id)}
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
        </>
      )}
    </div>
  );
}
