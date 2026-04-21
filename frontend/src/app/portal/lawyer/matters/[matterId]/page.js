"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchMe,
  fetchMatter,
  fetchMatterDocuments,
  uploadMatterFile,
  getDocumentAccessLinks,
  updateMatter,
  fetchInternalNotes,
  createInternalNote,
  fetchSharedUpdates,
  createSharedUpdate,
  fetchMatterEvents,
} from "../../../../lib/auth";

const STATUS_OPTIONS = ["Open", "In Progress", "Waiting on Client", "Closed"];
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

function normalizeStatus(status) {
  const value = (status || "").toString().trim();
  if (!value) return "Open";
  return value;
}

function getStatusBadgeClass(status) {
  const s = normalizeStatus(status);
  return `whitespace-nowrap rounded-full border px-3 py-1 text-sm font-medium ${
    s === "Closed"
      ? "border-red-200 bg-red-50 text-red-700"
      : s === "Waiting on Client"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : s === "In Progress"
      ? "border-green-200 bg-green-50 text-green-700"
      : "border-blue-200 bg-blue-50 text-blue-700"
  }`;
}

export default function LawyerMatterDetailPage({ params }) {
  const router = useRouter();
  const { matterId } = params;

  const [matter, setMatter] = useState(null);
  const [docs, setDocs] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [matterLoading, setMatterLoading] = useState(true);
  const [documentsLoading, setDocumentsLoading] = useState(true);
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

  async function refreshInternalNotesAndEvents() {
    const [internalResult, eventsResult] = await Promise.allSettled([
      fetchInternalNotes(matterId),
      fetchMatterEvents(matterId),
    ]);

    if (internalResult.status === "fulfilled") {
      setInternalNotes(Array.isArray(internalResult.value) ? internalResult.value : []);
      setInternalNotesError("");
    } else {
      setInternalNotesError(
        getErrorMessage(internalResult.reason, "Failed to load internal notes.")
      );
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
        setInternalNotesLoading(true);
        setSharedUpdatesLoading(true);
        setEventsLoading(true);
      }

      try {
        const me = await fetchMe();
        if (!me || me.role !== "lawyer") {
          router.push("/portal");
          return;
        }

        const [
          matterResult,
          documentsResult,
          internalResult,
          sharedResult,
          eventsResult,
        ] = await Promise.allSettled([
          fetchMatter(matterId),
          fetchMatterDocuments(matterId),
          fetchInternalNotes(matterId),
          fetchSharedUpdates(matterId),
          fetchMatterEvents(matterId),
        ]);

        if (cancelled) return;

        if (matterResult.status === "fulfilled") {
          setMatter(matterResult.value ?? null);
          setDescriptionDraft(matterResult.value?.description || "");
        } else {
          setMatter(null);
          setDescriptionDraft("");
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

        if (internalResult.status === "fulfilled") {
          setInternalNotes(Array.isArray(internalResult.value) ? internalResult.value : []);
          setInternalNotesError("");
        } else {
          setInternalNotes([]);
          setInternalNotesError(
            getErrorMessage(internalResult.reason, "Failed to load internal notes.")
          );
        }
        setInternalNotesLoading(false);

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
          setInternalNotesLoading(false);
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

  async function handleStatusChange(nextStatus) {
    if (!matter) return;
    setActionError("");
    setActionSuccess("");
    setStatusSaving(true);
    try {
      const updated = await updateMatter(matterId, { status: nextStatus });
      setMatter(updated);
      await refreshEvents();
      setActionSuccess("Status updated.");
    } catch (e) {
      setActionError(getErrorMessage(e, "Failed to update status."));
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
      await refreshEvents();
      setActionSuccess("Description updated.");
    } catch (e) {
      setActionError(getErrorMessage(e, "Failed to update description."));
    } finally {
      setDescriptionSaving(false);
    }
  }

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

      const fileInput = document.getElementById("lawyer-workspace-upload-input");
      if (fileInput) fileInput.value = "";
    } catch (e) {
      setDocumentsError(getErrorMessage(e, "Upload failed."));
    } finally {
      setUploadBusy(false);
      setDocumentsLoading(false);
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
      await createInternalNote(matterId, content);
      setInternalNoteContent("");
      await refreshInternalNotesAndEvents();
    } catch (e) {
      setInternalNotesError(getErrorMessage(e, "Failed to create internal note."));
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
    <div className="container mx-auto px-4 py-10 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => router.push("/portal/lawyer")}
            className="text-sm text-blue-700 hover:underline"
          >
            ← Back to dashboard
          </button>

          <h1 className="mt-3 text-2xl font-semibold text-slate-900 break-words">
            {matterLoading ? "Loading matter..." : matter?.title || "Matter"}
          </h1>

          <p className="mt-3 text-sm text-slate-500">
            Matter #{matter?.id ?? "—"} • Created {formatDateTime(matter?.created_at)}
          </p>
        </div>

        <span className={getStatusBadgeClass(matter?.status)}>
          {matterLoading ? "Loading..." : normalizeStatus(matter?.status)}
        </span>
      </div>

      {pageError && (
        <div className="rounded-2xl border bg-white shadow-xl p-6">
          <p className="text-sm text-red-600">{pageError}</p>
        </div>
      )}

      {(actionError || actionSuccess) && (
        <div className="space-y-2">
          {actionError && <p className="text-sm text-red-600">{actionError}</p>}
          {actionSuccess && <p className="text-sm text-green-600">{actionSuccess}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 rounded-2xl border bg-white shadow-xl p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Matter Details</h2>
            <p className="mt-2 text-sm text-slate-600">
              Manage the case summary, status, and current working details.
            </p>
          </div>

          {matterLoading ? (
            <p className="mt-6 text-sm text-slate-600">Loading matter details...</p>
          ) : matter ? (
            <div className="mt-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-800">Status</label>
                <select
                  value={matter.status || "Open"}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={statusSaving}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-600 focus:ring-blue-600 disabled:opacity-60"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-800">Description</label>
                <p className="mt-1 text-xs text-slate-500">
                  Use this area to keep the current matter summary and next steps up to date.
                </p>
                <textarea
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  rows={6}
                  className="mt-2 min-h-[180px] w-full rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm resize-y placeholder:text-slate-400 focus:border-blue-600 focus:ring-blue-600"
                  placeholder="Add details for this matter..."
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleDescriptionSave}
                  disabled={descriptionSaving}
                  className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {descriptionSaving ? "Saving..." : "Save description"}
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm text-slate-500">Matter details are unavailable.</p>
          )}
        </section>

        <section className="xl:col-span-1 rounded-2xl border bg-white shadow-xl p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
            <p className="mt-2 text-sm text-slate-600">
              Upload files for this matter and access them here.
            </p>
          </div>

          <div className="mt-6 space-y-6">
            <div className="space-y-3">
              <input
                id="lawyer-workspace-upload-input"
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

              <p className="text-xs text-slate-500">
                {uploadFile
                  ? `Selected: ${uploadFile.name} (${Math.ceil(uploadFile.size / 1024)} KB)`
                  : "Allowed: PDF, DOC, DOCX, JPG, PNG • Max 25MB"}
              </p>

              <button
                type="button"
                onClick={handleUploadDocument}
                disabled={uploadBusy || !uploadFile}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {uploadBusy ? "Uploading..." : "Upload document"}
              </button>
            </div>

            {documentsError && <p className="text-sm text-red-600">{documentsError}</p>}

            {documentsLoading ? (
              <p className="text-sm text-slate-600">Loading documents...</p>
            ) : docs.length ? (
              <div className="max-h-[420px] overflow-y-auto space-y-5 pr-1">
                {docs.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900 break-words">{d.filename}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Uploaded {formatDateTime(d.created_at)}
                      </p>
                    </div>

                    <div className="mt-3 flex gap-2 flex-wrap">
                      {isPreviewableFile(d.filename) && (
                        <button
                          type="button"
                          onMouseEnter={() => {
                            void ensureDocumentLinks(d);
                          }}
                          onClick={() => handleOpenDocument(d)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Open
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDownloadDocument(d)}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No documents yet.
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="rounded-2xl border bg-white shadow-xl p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Internal Notes</h2>
            <p className="mt-2 text-sm text-slate-600">
              Private notes visible only to the lawyer.
            </p>
          </div>

          <form className="mt-6 space-y-3" onSubmit={handleCreateInternalNote}>
            <textarea
              value={internalNoteContent}
              onChange={(e) => setInternalNoteContent(e.target.value)}
              rows={4}
              className="min-h-[140px] w-full rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm resize-y placeholder:text-slate-400 focus:border-blue-600 focus:ring-blue-600"
              placeholder="Add a private internal note..."
            />

            {internalNotesError && <p className="text-sm text-red-600">{internalNotesError}</p>}

            <div className="mt-2">
              <button
                type="submit"
                disabled={internalNoteBusy}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {internalNoteBusy ? "Saving..." : "Add Internal Note"}
              </button>
            </div>
          </form>

          <div className="mt-6 max-h-[320px] overflow-y-auto space-y-3 pr-1">
            {internalNotesLoading ? (
              <p className="text-sm text-slate-600">Loading internal notes...</p>
            ) : internalNotes.length ? (
              internalNotes.map((n) => (
                <div
                  key={n.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <p className="text-sm font-semibold text-slate-900">
                      {n.user_name || `User ${n.user_id}`}
                    </p>
                    <p className="text-xs text-slate-500 whitespace-nowrap">
                      {formatDateTime(n.created_at)}
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-700 whitespace-pre-wrap break-words">
                    {n.content}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No internal notes yet.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border bg-white shadow-xl p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Shared Updates</h2>
            <p className="mt-2 text-sm text-slate-600">
              Updates shared with the client for this matter.
            </p>
          </div>

          <form className="mt-6 space-y-3" onSubmit={handleCreateSharedUpdate}>
            <textarea
              value={sharedUpdateContent}
              onChange={(e) => setSharedUpdateContent(e.target.value)}
              rows={4}
              className="min-h-[140px] w-full rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm resize-y placeholder:text-slate-400 focus:border-blue-600 focus:ring-blue-600"
              placeholder="Add a shared update..."
            />

            {sharedUpdatesError && <p className="text-sm text-red-600">{sharedUpdatesError}</p>}

            <div className="mt-2">
              <button
                type="submit"
                disabled={sharedUpdateBusy}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {sharedUpdateBusy ? "Saving..." : "Add Shared Update"}
              </button>
            </div>
          </form>

          <div className="mt-6 max-h-[320px] overflow-y-auto space-y-3 pr-1">
            {sharedUpdatesLoading ? (
              <p className="text-sm text-slate-600">Loading shared updates...</p>
            ) : sharedUpdates.length ? (
              sharedUpdates.map((n) => (
                <div
                  key={n.id}
                  className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <p className="text-sm font-semibold text-slate-900">
                      {n.user_name || `User ${n.user_id}`}
                    </p>
                    <p className="text-xs text-slate-500 whitespace-nowrap">
                      {formatDateTime(n.created_at)}
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-700 whitespace-pre-wrap break-words">
                    {n.content}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No shared updates yet.
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border bg-white shadow-xl p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Activity</h2>
          <p className="mt-2 text-sm text-slate-500">
            Timeline of activity for this matter.
          </p>
        </div>

        <div className="mt-6">
          <div className="max-h-[280px] overflow-y-auto pr-1">
            {eventsLoading ? (
              <p className="text-sm text-slate-600">Loading activity...</p>
            ) : eventsError ? (
              <p className="text-sm text-red-600">{eventsError}</p>
            ) : events.length ? (
              <ul className="space-y-3">
                {events.map((ev) => (
                  <li
                    key={ev.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-sm text-slate-800">{ev.message}</p>
                      <p className="text-xs text-slate-500 whitespace-nowrap">
                        {formatDateTime(ev.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No activity yet.
              </div>
            )}
          </div>
        </div>
      </section>

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
    </div>
  );
}
