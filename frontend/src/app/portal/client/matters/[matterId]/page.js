"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchMe,
  fetchMatter,
  fetchMatterDocuments,
  uploadMatterFile,
  getDocumentAccessLinks,
  fetchSharedUpdates,
  createSharedUpdate,
  fetchMatterEvents,
} from "../../../../lib/auth";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
];

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
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

function getErrorMessage(error, fallback) {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (typeof error?.message === "string" && error.message.trim()) return error.message;
  return fallback;
}

export default function ClientMatterDetailPage({ params }) {
  const router = useRouter();
  const { matterId } = params;

  const [matter, setMatter] = useState(null);
  const [docs, setDocs] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [matterLoading, setMatterLoading] = useState(true);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const [sharedUpdates, setSharedUpdates] = useState([]);
  const [sharedUpdatesLoading, setSharedUpdatesLoading] = useState(true);
  const [sharedUpdateContent, setSharedUpdateContent] = useState("");
  const [sharedUpdateBusy, setSharedUpdateBusy] = useState(false);
  const [sharedUpdatesError, setSharedUpdatesError] = useState("");
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState("");
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [documentLinks, setDocumentLinks] = useState({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [documentsError, setDocumentsError] = useState("");

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

  async function refreshEvents() {
    try {
      const eventList = await fetchMatterEvents(matterId);
      setEvents(Array.isArray(eventList) ? eventList : []);
      setEventsError("");
    } catch (e) {
      setEventsError(getErrorMessage(e, "Failed to load activity."));
    }
  }

  async function refreshDocumentsAndEvents() {
    const [documentsResult, eventsResult] = await Promise.allSettled([
      fetchMatterDocuments(matterId),
      fetchMatterEvents(matterId),
    ]);

    if (documentsResult.status === "fulfilled") {
      setDocs(Array.isArray(documentsResult.value) ? documentsResult.value : []);
      setDocumentsError("");
    } else {
      setDocumentsError(getErrorMessage(documentsResult.reason, "Failed to load documents."));
    }

    if (eventsResult.status === "fulfilled") {
      setEvents(Array.isArray(eventsResult.value) ? eventsResult.value : []);
      setEventsError("");
    } else {
      setEventsError(getErrorMessage(eventsResult.reason, "Failed to load activity."));
    }
  }

  async function refreshSharedUpdatesAndEvents() {
    const [sharedResult, eventsResult] = await Promise.allSettled([
      fetchSharedUpdates(matterId),
      fetchMatterEvents(matterId),
    ]);

    if (sharedResult.status === "fulfilled") {
      setSharedUpdates(Array.isArray(sharedResult.value) ? sharedResult.value : []);
      setSharedUpdatesError("");
    } else {
      setSharedUpdatesError(
        getErrorMessage(sharedResult.reason, "Failed to load shared updates.")
      );
    }

    if (eventsResult.status === "fulfilled") {
      setEvents(Array.isArray(eventsResult.value) ? eventsResult.value : []);
      setEventsError("");
    } else {
      setEventsError(getErrorMessage(eventsResult.reason, "Failed to load activity."));
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!cancelled) {
        setPageError("");
        setMatterLoading(true);
        setDocumentsLoading(true);
        setSharedUpdatesLoading(true);
        setEventsLoading(true);
      }

      try {
        const me = await fetchMe();
        if (!me || me.role !== "client") {
          router.push("/portal");
          return;
        }

        const [matterResult, documentsResult, sharedResult, eventsResult] =
          await Promise.allSettled([
          fetchMatter(matterId),
          fetchMatterDocuments(matterId),
          fetchSharedUpdates(matterId),
          fetchMatterEvents(matterId),
        ]);

        if (cancelled) return;

        if (matterResult.status === "fulfilled") {
          setMatter(matterResult.value ?? null);
        } else {
          setMatter(null);
          setPageError(getErrorMessage(matterResult.reason, "Failed to load matter."));
        }
        setMatterLoading(false);

        if (documentsResult.status === "fulfilled") {
          setDocs(Array.isArray(documentsResult.value) ? documentsResult.value : []);
          setDocumentsError("");
        } else {
          setDocs([]);
          setDocumentsError(getErrorMessage(documentsResult.reason, "Failed to load documents."));
        }
        setDocumentsLoading(false);

        if (sharedResult.status === "fulfilled") {
          setSharedUpdates(Array.isArray(sharedResult.value) ? sharedResult.value : []);
          setSharedUpdatesError("");
        } else {
          setSharedUpdates([]);
          setSharedUpdatesError(
            getErrorMessage(sharedResult.reason, "Failed to load shared updates.")
          );
        }
        setSharedUpdatesLoading(false);

        if (eventsResult.status === "fulfilled") {
          setEvents(Array.isArray(eventsResult.value) ? eventsResult.value : []);
          setEventsError("");
        } else {
          setEvents([]);
          setEventsError(getErrorMessage(eventsResult.reason, "Failed to load activity."));
        }
        setEventsLoading(false);
      } catch (e) {
        if (!cancelled) setPageError(getErrorMessage(e, "Failed to load workspace."));
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
          setMatterLoading(false);
          setDocumentsLoading(false);
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

  async function handleOpenDocument(doc) {
    setActionError("");
    setDocumentsError("");
    setPreviewError("");
    setPreviewLoading(false);
    setSelectedDocument(doc);
    if (!isPreviewableFile(doc?.filename)) {
      return;
    }

    setPreviewLoading(true);
    try {
      await ensureDocumentLinks(doc);
    } catch (e) {
      const message = getErrorMessage(e, "Could not load document.");
      setPreviewError(message);
      setActionError(message);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleDownloadDocument(doc) {
    setActionError("");
    setDocumentsError("");
    try {
      const links = await ensureDocumentLinks(doc);
      if (typeof window !== "undefined" && links?.download_url) {
        window.location.assign(links.download_url);
      }
    } catch (e) {
      const message = getErrorMessage(e, "Could not download document.");
      setActionError(message);
      setDocumentsError(message);
    }
  }

  async function handleUploadDocument() {
    setDocumentsError("");
    if (!uploadFile) {
      setDocumentsError("Choose a file first.");
      return;
    }
    if (uploadFile.size > MAX_FILE_SIZE) {
      setDocumentsError("File must be under 25MB.");
      return;
    }
    if (uploadFile.type && !ALLOWED_TYPES.includes(uploadFile.type)) {
      setDocumentsError("Unsupported file type. Please upload PDF, DOC, DOCX, JPG, or PNG.");
      return;
    }

    setUploadBusy(true);
    setDocumentsLoading(true);
    try {
      await uploadMatterFile(Number(matterId), uploadFile);
      setUploadFile(null);
      await refreshDocumentsAndEvents();

      const fileInput = document.getElementById("client-workspace-upload-input");
      if (fileInput) fileInput.value = "";
    } catch (e) {
      setDocumentsError(getErrorMessage(e, "Upload failed."));
    } finally {
      setUploadBusy(false);
      setDocumentsLoading(false);
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
      await createSharedUpdate(matterId, content);
      setSharedUpdateContent("");
      await refreshSharedUpdatesAndEvents();
    } catch (e) {
      setSharedUpdatesError(getErrorMessage(e, "Failed to create shared update."));
    } finally {
      setSharedUpdateBusy(false);
    }
  }

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-10">
        <p className="text-sm text-slate-600">Loading workspace...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <Link href="/portal/client" className="text-sm text-blue-700 hover:underline">
        ← Back to dashboard
      </Link>

      {pageError && <p className="mt-4 text-sm text-red-600">{pageError}</p>}

      <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          {matterLoading ? (
            <>
              <h1 className="text-2xl font-bold text-slate-900">Loading matter...</h1>
              <p className="mt-1 text-xs text-slate-500">Please wait while we load details.</p>
            </>
          ) : matter ? (
            <>
              <h1 className="text-2xl font-bold text-slate-900">{matter.title}</h1>
              <p className="mt-1 text-xs text-slate-500">
                Matter #{matter.id} • Created {formatDateTime(matter.created_at)}
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-slate-900">Matter unavailable</h1>
              <p className="mt-1 text-xs text-slate-500">
                This matter could not be loaded or you do not have access.
              </p>
            </>
          )}
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
          {matterLoading ? "Loading..." : matter?.status || "Open"}
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl bg-white border shadow-xl p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">Matter Details</h2>
          {matterLoading ? (
            <p className="mt-4 text-sm text-slate-600">Loading matter details...</p>
          ) : (
            <p className="mt-4 text-sm text-slate-700 whitespace-pre-wrap">
              {matter?.description || "No description provided yet."}
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-white border shadow-xl p-6">
          <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
          <p className="mt-2 text-sm text-slate-600">
            Open documents in a modal or download them directly.
          </p>

          <div className="mt-4 space-y-3">
                <input
                  id="client-workspace-upload-input"
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setDocumentsError("");
                    setUploadFile(null);

                    if (!f) return;
                    if (f.size > MAX_FILE_SIZE) {
                      setDocumentsError("File must be under 25MB.");
                      e.target.value = "";
                      return;
                    }
                    if (f.type && !ALLOWED_TYPES.includes(f.type)) {
                      setDocumentsError(
                        "Unsupported file type. Please upload PDF, DOC, DOCX, JPG, or PNG."
                      );
                      e.target.value = "";
                      return;
                    }
                    setUploadFile(f);
                  }}
                  className="block w-full text-sm"
                  disabled={uploadBusy}
                />

                {uploadFile ? (
                  <p className="text-xs text-slate-600">
                    Selected: <span className="font-medium">{uploadFile.name}</span>{" "}
                    ({Math.ceil(uploadFile.size / 1024)} KB)
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Allowed: PDF, DOC, DOCX, JPG, PNG • Max 25MB
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleUploadDocument}
                  disabled={uploadBusy || !uploadFile}
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {uploadBusy ? "Uploading..." : "Upload document"}
                </button>

                {documentsError && <p className="text-sm text-red-600">{documentsError}</p>}
          </div>

          {documentsLoading ? (
            <p className="mt-4 text-sm text-slate-600">Loading documents...</p>
          ) : (
            <ul className="mt-4 space-y-2 rounded-xl border bg-slate-50 p-2 max-h-[420px] overflow-y-auto">
              {docs.length ? (
                docs.map((d) => (
                    <li key={d.id} className="rounded-lg border bg-white p-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 break-words">
                            {d.filename}
                          </p>
                          <p className="text-xs text-slate-500">
                            Uploaded {formatDateTime(d.created_at)}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            type="button"
                            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                            onMouseEnter={() => {
                              if (isPreviewableFile(d.filename)) {
                                void ensureDocumentLinks(d);
                              }
                            }}
                            onClick={() => handleOpenDocument(d)}
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            onClick={() => handleDownloadDocument(d)}
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
          )}
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
                    <p className="text-sm text-slate-600">Loading document...</p>
                  ) : previewError ? (
                    <p className="text-sm text-red-600">{previewError}</p>
                  ) : !isPreviewableFile(selectedDocument.filename) ? (
                    <p className="text-sm text-slate-500">
                      This file type cannot be opened in the in-app viewer. Use Download instead.
                    </p>
                  ) : documentLinks[selectedDocument.id]?.content_url ? (
                    isPreviewablePdf(selectedDocument.filename) ? (
                      <iframe
                        src={documentLinks[selectedDocument.id].content_url}
                        title={selectedDocument.filename}
                        className="h-[500px] w-full rounded-xl border bg-white"
                      />
                    ) : (
                      <img
                        src={documentLinks[selectedDocument.id].content_url}
                        alt={selectedDocument.filename}
                        className="max-h-[700px] w-full rounded-xl border object-contain bg-slate-50"
                      />
                    )
                  ) : (
                    <p className="text-sm text-slate-500">Open is not available for this file.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {actionError && <p className="mt-4 text-sm text-red-600">{actionError}</p>}
    </div>
  );
}
