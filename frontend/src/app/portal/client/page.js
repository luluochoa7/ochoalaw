"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchMyMatters,
  fetchMe,
  uploadMatterFile,
  fetchMatterDocuments,
  getDocumentAccessLinks,
} from "../../lib/auth";

function normalizeStatus(s) {
  const val = (s || "").toString().trim();
  if (!val) return "Open";
  return val[0].toUpperCase() + val.slice(1);
}

function statusBadgeClass(status) {
  const s = normalizeStatus(status);
  if (s === "Closed") return "bg-red-100 text-red-700";
  if (s === "Waiting on Client") return "bg-amber-100 text-amber-700";
  if (s === "In Progress") return "bg-green-100 text-green-700";
  if (s === "Open") return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-700";
}

function fmtDateShort(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getFileExtension(filename) {
  if (!filename) return "";
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
}

function isPreviewablePdf(filename) {
  return getFileExtension(filename) === "pdf";
}

function isPreviewableImage(filename) {
  return ["jpg", "jpeg", "png", "webp"].includes(getFileExtension(filename));
}

function isPreviewableFile(filename) {
  return isPreviewablePdf(filename) || isPreviewableImage(filename);
}

function linksAreExpired(links) {
  if (!links?.expires_at) return true;
  const exp = new Date(links.expires_at);
  if (Number.isNaN(exp.getTime())) return true;
  return exp.getTime() - Date.now() < 30 * 1000;
}

function DocumentsPanel({ matters, loadingMatters }) {
  const [selectedMatterId, setSelectedMatterId] = useState("");
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [documentLinks, setDocumentLinks] = useState({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  // File Size Limits
  const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB File Size Max
  const ALLOWED_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
  ];

  function fmtDateTime(iso) {
    if (!iso) return "";
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  async function ensureDocumentLinks(doc, forceRefresh = false) {
    if (!doc?.id) throw new Error("Invalid document");

    const existing = documentLinks[doc.id];
    if (!forceRefresh && existing && !linksAreExpired(existing)) {
      return existing;
    }

    const links = await getDocumentAccessLinks(doc.id);
    setDocumentLinks((prev) => ({ ...prev, [doc.id]: links }));
    return links;
  }

  function openDocumentUrl(url) {
    if (typeof window === "undefined" || !url) return;
    window.location.assign(url);
  }

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

  useEffect(() => {
    if (!selectedDocument?.id) return;
    const next = docs.find((doc) => doc.id === selectedDocument.id) || null;
    if (!next) {
      setSelectedDocument(null);
      setPreviewError("");
      return;
    }
    if (next.filename !== selectedDocument.filename) {
      setSelectedDocument(next);
    }
  }, [docs, selectedDocument]);

  async function handleUpload() {
    if (!selectedMatterId) return setErr("Pick a matter first.");
    if (!file) return setErr("Choose a file first.");
    if (file.size > MAX_FILE_SIZE) return setErr("File must be under 25MB.");
    if (file.type && !ALLOWED_TYPES.includes(file.type)) {
      return setErr("Unsupported file type. Please upload PDF, DOC, DOCX, JPG, or PNG.");
    }

    setBusy(true);
    setErr("");

    try {
      // SINGLE CALL (frontend): handles presign -> PUT -> complete
      await uploadMatterFile(Number(selectedMatterId), file);

      // refresh list
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

  async function handlePreview(doc) {
    setErr("");
    setPreviewError("");
    setSelectedDocument(doc);
    setPreviewLoading(true);
    try {
      await ensureDocumentLinks(doc);
    } catch (e) {
      console.error(e);
      setPreviewError(e?.message || "Could not load preview.");
      setErr(e?.message || "Could not load preview.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleOpen(doc) {
    setErr("");
    try {
      const links = await ensureDocumentLinks(doc);
      openDocumentUrl(links?.content_url);
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Could not open document.");
    }
  }

  async function handleDownload(doc) {
    setErr("");
    try {
      const links = await ensureDocumentLinks(doc);
      openDocumentUrl(links?.download_url);
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Could not download document.");
    }
  }

  return (
    <div className="rounded-2xl bg-white shadow-xl border p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-slate-900">Documents</h2>

        <div className="w-full sm:w-auto">
          <select
            className="w-full sm:w-[280px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
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
      </div>

      <p className="mt-2 text-sm text-slate-600">
        Upload files into the selected matter and preview, open, or download them.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <input
          id="client-doc-upload-input"
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setErr("");
            setFile(null);

            if (!f) return;

            if (f.size > MAX_FILE_SIZE) {
              setErr("File must be under 25MB.");
              e.target.value = ""; // reset picker
              return;
            }
            if (f.type && !ALLOWED_TYPES.includes(f.type)) {
              setErr("Unsupported file type. Please upload PDF, DOC, DOCX, JPG, or PNG.");
              e.target.value = ""; // reset picker
              return;
            }
            setFile(f); // only set if valid
          }}
          className="block w-full text-sm"
          disabled={!selectedMatterId || busy}
        />

        {file ? (
          <p className="text-xs text-slate-600">
            Selected: <span className="font-medium">{file.name}</span>{" "}
            ({Math.ceil(file.size / 1024)} KB)
          </p>
        ) : (
          <p className="text-xs text-slate-500">
            Allowed: PDF, DOC, DOCX, JPG, PNG • Max 25MB
          </p>
        )}

        <button
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          disabled={!selectedMatterId || busy || !file}
          onClick={handleUpload}
          type="button"
        >
          {busy ? "Uploading…" : "Upload document"}
        </button>

        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>

      <div className="mt-5">
        <p className="text-sm font-medium text-slate-900">Uploaded files</p>

        <ul className="mt-2 max-h-[320px] overflow-y-auto space-y-2 rounded-xl border bg-slate-50 p-2">
          {docsLoading ? (
            <li className="rounded-lg border bg-white p-3 text-sm text-slate-600">
              Loading documents...
            </li>
          ) : docs?.length ? (
            docs.map((d) => (
              <li key={d.id} className="rounded-lg border bg-white p-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 break-words">
                      {d.filename}
                    </p>
                    <p className="text-xs text-slate-500">
                      Uploaded {d.created_at ? fmtDateTime(d.created_at) : "—"}
                    </p>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {isPreviewableFile(d.filename) && (
                      <button
                        type="button"
                        onClick={() => handlePreview(d)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Preview
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpen(d)}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(d)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Download
                    </button>
                  </div>
                </div>
              </li>
            ))
          ) : (
            <li className="rounded-lg border bg-white p-3 text-sm text-slate-600">
              No documents yet.
            </li>
          )}
        </ul>
      </div>

      {selectedDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-slate-900 break-words">
                {selectedDocument.filename}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setSelectedDocument(null);
                  setPreviewError("");
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="mt-4">
              {previewLoading ? (
                <p className="text-sm text-slate-600">Loading preview...</p>
              ) : previewError ? (
                <p className="text-sm text-red-600">{previewError}</p>
              ) : documentLinks[selectedDocument.id]?.content_url ? (
                isPreviewablePdf(selectedDocument.filename) ? (
                  <iframe
                    src={documentLinks[selectedDocument.id].content_url}
                    title={selectedDocument.filename}
                    className="h-[500px] w-full rounded-xl border bg-white"
                  />
                ) : isPreviewableImage(selectedDocument.filename) ? (
                  <img
                    src={documentLinks[selectedDocument.id].content_url}
                    alt={selectedDocument.filename}
                    className="max-h-[700px] w-full rounded-xl border object-contain bg-slate-50"
                  />
                ) : (
                  <p className="text-sm text-slate-500">
                    Preview is not available for this file type.
                  </p>
                )
              ) : (
                <p className="text-sm text-slate-500">Preview is not available.</p>
              )}
            </div>
          </div>
        </div>
      )}
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
    <>
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
              <div className="-mx-6 -mt-6 px-6 py-4 border-b bg-white/70 backdrop-blur rounded-t-2xl sticky top-0 z-10">
                <h2 className="text-lg font-semibold text-slate-900">
                  Your Matters
                </h2>
              </div>

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
                  <>
                    <ul className="mt-3 max-h-[420px] overflow-y-auto space-y-2 pr-1">
                      {matters.map((m) => (
                        <li key={m.id}>
                          <Link
                            href={`/portal/client/matters/${m.id}`}
                            prefetch={true}
                            className="flex items-center justify-between rounded-xl border bg-white px-4 py-4 shadow-sm hover:shadow-md hover:border-slate-300 hover:-translate-y-[1px] transition cursor-pointer"
                          >
                            <div>
                              <p className="font-medium text-slate-900">
                                {m.title}
                              </p>
                              <p className="text-xs text-slate-500">
                                Matter #{m.id} • {m.created_at ? fmtDateShort(m.created_at) : "—"}
                              </p>
                            </div>
                            <span
                              className={`text-xs px-3 py-1 rounded-full font-medium whitespace-nowrap ${statusBadgeClass(
                                m.status
                              )}`}
                            >
                              {normalizeStatus(m.status)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <div className="pointer-events-none mt-2 h-6 bg-gradient-to-b from-transparent to-white" />
                  </>
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
    </>
  );
}
