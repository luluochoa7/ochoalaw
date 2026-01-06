"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import RequireAuth from "../../components/RequireAuth";
import {
  fetchMyMatters,
  fetchMe,
  presignMatterUpload,
  completeMatterUpload,
  fetchMatterDocuments,
} from "../../lib/auth";

function DocumentsPanel({ matters, loadingMatters }) {
  const [selectedMatterId, setSelectedMatterId] = useState("");
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // default selected matter when matters load
  useEffect(() => {
    if (!selectedMatterId && matters?.length) {
      setSelectedMatterId(String(matters[0].id));
    }
  }, [matters, selectedMatterId]);

  // load docs when selection changes
  useEffect(() => {
    let cancelled = false;

    async function loadDocs() {
      if (!selectedMatterId) return;
      setErr("");
      setDocsLoading(true);
      try {
        const list = await fetchMatterDocuments(selectedMatterId);
        if (!cancelled) setDocs(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Could not load documents.");
      } finally {
        if (!cancelled) setDocsLoading(false);
      }
    }

    loadDocs();
    return () => {
      cancelled = true;
    };
  }, [selectedMatterId]);

  async function handleUpload() {
    if (!selectedMatterId) return setErr("Pick a matter first.");
    if (!file) return setErr("Choose a file first.");

    setBusy(true);
    setErr("");

    try {
      const contentType = file.type || "application/octet-stream";

      // 1) presign
      const { upload_url, object_key } = await presignMatterUpload(
        selectedMatterId,
        file.name,
        contentType
      );

      // 2) PUT to S3
      const putRes = await fetch(upload_url, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });

      if (!putRes.ok) {
        throw new Error(`Upload failed (S3): ${putRes.status}`);
      }

      // 3) create Document record
      await completeMatterUpload(selectedMatterId, file.name, object_key);

      // 4) refresh list
      const list = await fetchMatterDocuments(selectedMatterId);
      setDocs(Array.isArray(list) ? list : []);
      setFile(null);

      // reset the input UI (optional quality of life)
      const el = document.getElementById("client-doc-upload-input");
      if (el) el.value = "";
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white shadow-xl border p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-slate-900">Documents</h2>

        <select
          className="rounded-lg border px-3 py-2 text-sm"
          value={selectedMatterId}
          onChange={(e) => setSelectedMatterId(e.target.value)}
          disabled={loadingMatters || !matters?.length}
        >
          {matters?.length ? (
            matters.map((m) => (
              <option key={m.id} value={String(m.id)}>
                {m.title} (#{m.id})
              </option>
            ))
          ) : (
            <option value="">No matters yet</option>
          )}
        </select>
      </div>

      <p className="mt-2 text-sm text-slate-600">
        Upload and view files related to your case.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <input
          id="client-doc-upload-input"
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm"
          disabled={!selectedMatterId || busy}
        />

        <button
          className="w-full rounded-lg bg-slate-900 px-4 py-3 text-white hover:bg-black disabled:opacity-60"
          disabled={!selectedMatterId || busy || !file}
          onClick={handleUpload}
          type="button"
        >
          {busy ? "Uploading..." : "Upload document"}
        </button>

        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>

      <div className="mt-5">
        <p className="text-sm font-medium text-slate-900">Uploaded files</p>

        <ul className="mt-2 divide-y rounded-xl border">
          {docsLoading ? (
            <li className="p-3 text-sm text-slate-600">Loading documents…</li>
          ) : docs?.length ? (
            docs.map((d) => (
              <li key={d.id} className="p-3">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {d.filename}
                </p>
                <p className="text-xs text-slate-500 truncate">{d.s3_key}</p>
              </li>
            ))
          ) : (
            <li className="p-3 text-sm text-slate-600">No documents yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

export default function ClientDashboardPage() {
  const router = useRouter();
  const [matters, setMatters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const me = await fetchMe();
        if (me.role !== "client") {
          router.push("/portal");
          return;
        }
        const data = await fetchMyMatters();
        setMatters(data || []);
      } catch (e) {
        setError("Could not load your matters.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  return (
    <RequireAuth>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />

        <main className="flex-1 mt-16">
          {/* Header */}
          <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-black">
            <div className="container mx-auto px-4 py-12 text-center">
              <h1 className="text-3xl font-bold text-white">
                Your Client Portal
              </h1>
              <p className="mt-2 text-blue-100">
                Everything related to your legal matters — in one secure place.
              </p>
            </div>
          </section>

          {/* Content */}
          <section className="-mt-8 pb-16">
            <div className="container mx-auto px-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Matters */}
                <div className="rounded-2xl bg-white shadow-xl border p-6">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Your Matters
                  </h2>

                  <div className="mt-4">
                    {loading ? (
                      <p className="text-sm text-slate-600">Loading…</p>
                    ) : error ? (
                      <p className="text-sm text-red-600">{error}</p>
                    ) : matters.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        You don’t have any active matters yet.
                      </p>
                    ) : (
                      <ul className="divide-y">
                        {matters.map((m) => (
                          <li
                            key={m.id}
                            className="py-3 flex justify-between items-center"
                          >
                            <div>
                              <p className="font-medium text-slate-900">
                                {m.title}
                              </p>
                              <p className="text-xs text-slate-500">
                                Matter #{m.id}
                              </p>
                            </div>
                            <span className="rounded-full bg-blue-50 text-blue-700 text-xs px-3 py-1">
                              {m.status || "Active"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div className="rounded-2xl bg-white shadow-xl border p-6">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Secure Messages
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Communicate securely with your legal team.
                  </p>
                  <button
                    className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    onClick={() => alert("Messaging coming soon")}
                    type="button"
                  >
                    Open Inbox
                  </button>
                </div>
              </div>

              {/* Side column */}
              <div className="space-y-6">
                {/* Documents (NOW FUNCTIONAL) */}
                <DocumentsPanel matters={matters} loadingMatters={loading} />
              </div>
            </div>
          </section>
        </main>
      </div>
    </RequireAuth>
  );
}