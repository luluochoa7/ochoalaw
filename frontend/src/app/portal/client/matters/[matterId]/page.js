"use client";

import { useEffect, useRef, useState } from "react";
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
  fetchMatterMessages,
  sendMatterMessage,
} from "../../../../lib/auth";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
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

function getCurrentHashId() {
  if (typeof window === "undefined") return "";
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function scrollToCurrentHash() {
  const hashId = getCurrentHashId();
  if (!hashId) return;

  window.requestAnimationFrame(() => {
    const target = document.getElementById(hashId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
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

export default function ClientMatterDetailPage({ params }) {
  const router = useRouter();
  const { matterId } = params;

  const [currentUser, setCurrentUser] = useState(null);
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
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messagesError, setMessagesError] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [documentLinks, setDocumentLinks] = useState({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [documentsError, setDocumentsError] = useState("");
  const messagesListRef = useRef(null);

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
        setMessagesLoading(true);
      }

      try {
        const me = await fetchMe(true);
        if (cancelled) return;
        if (!me || me.role !== "client") {
          router.push("/portal");
          return;
        }
        setCurrentUser(me);

        const [
          matterResult,
          documentsResult,
          sharedResult,
          eventsResult,
          messagesResult,
        ] = await Promise.allSettled([
          fetchMatter(matterId),
          fetchMatterDocuments(matterId),
          fetchSharedUpdates(matterId),
          fetchMatterEvents(matterId),
          fetchMatterMessages(matterId),
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

        if (messagesResult.status === "fulfilled") {
          setMessages(Array.isArray(messagesResult.value) ? messagesResult.value : []);
          setMessagesError("");
        } else {
          setMessages([]);
          setMessagesError(getErrorMessage(messagesResult.reason, "Failed to load messages."));
        }
        setMessagesLoading(false);
      } catch (e) {
        if (!cancelled) setPageError(getErrorMessage(e, "Failed to load workspace."));
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
          setMatterLoading(false);
          setDocumentsLoading(false);
          setSharedUpdatesLoading(false);
          setEventsLoading(false);
          setMessagesLoading(false);
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

  useEffect(() => {
    if (!messagesLoading && messagesListRef.current) {
      messagesListRef.current.scrollTop = messagesListRef.current.scrollHeight;
    }
  }, [messages, messagesLoading]);

  useEffect(() => {
    if (authLoading) return;

    const timeoutId = window.setTimeout(scrollToCurrentHash, 0);
    window.addEventListener("hashchange", scrollToCurrentHash);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("hashchange", scrollToCurrentHash);
    };
  }, [authLoading, matterId]);

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

  async function handleSendMessage(e) {
    e.preventDefault();
    const trimmed = newMessage.trim();
    if (!trimmed) return;

    setSendingMessage(true);
    setMessagesError("");
    try {
      const created = await sendMatterMessage(matterId, trimmed);
      setMessages((prev) => [...prev, created]);
      setNewMessage("");
      await refreshEvents();
    } catch (e) {
      setMessagesError(getErrorMessage(e, "Failed to send message."));
    } finally {
      setSendingMessage(false);
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
            onClick={() => router.push("/portal/client")}
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

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 rounded-2xl border bg-white shadow-xl p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Matter Details</h2>
            <p className="mt-2 text-sm text-slate-600">Key information about this matter.</p>
          </div>

          <div className="mt-6 space-y-4">
            {matterLoading ? (
              <p className="text-sm text-slate-600">Loading matter details...</p>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm leading-6 text-slate-700 whitespace-pre-wrap break-words">
                  {matter?.description || "No matter description available yet."}
                </p>
              </div>
            )}
          </div>
        </section>

        <section id="documents" className="scroll-mt-24 xl:col-span-1 rounded-2xl border bg-white shadow-xl p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
            <p className="mt-2 text-sm text-slate-600">
              Upload files for this matter and access them here.
            </p>
          </div>

          <div className="mt-6 space-y-6">
            <div className="space-y-3">
              <input
                id="client-workspace-upload-input"
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp"
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

      <section id="shared-updates" className="scroll-mt-24 rounded-2xl border bg-white shadow-xl p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Shared Updates</h2>
          <p className="mt-2 text-sm text-slate-600">
            Updates shared between you and your legal team for this matter.
          </p>
        </div>

        <form className="mt-6 space-y-3" onSubmit={handleCreateSharedUpdate}>
          <textarea
            value={sharedUpdateContent}
            onChange={(e) => setSharedUpdateContent(e.target.value)}
            rows={4}
            className="min-h-[140px] w-full rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm resize-y placeholder:text-slate-400 focus:border-blue-600 focus:ring-blue-600"
            placeholder="Add an update or response..."
          />

          {sharedUpdatesError && <p className="text-sm text-red-600">{sharedUpdatesError}</p>}

          <div className="mt-2">
            <button
              type="submit"
              disabled={sharedUpdateBusy}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {sharedUpdateBusy ? "Saving..." : "Add Update"}
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

      <section id="messages" className="scroll-mt-24 rounded-2xl border bg-white shadow-xl p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Secure Conversation</h2>
          <p className="mt-2 text-sm text-slate-600">
            Send secure messages to your legal team about this matter.
          </p>
        </div>

        <div className="mt-6 flex h-[460px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <div ref={messagesListRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messagesLoading ? (
              <p className="text-sm text-slate-600">Loading messages...</p>
            ) : messagesError && !messages.length ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {messagesError}
              </div>
            ) : messages.length ? (
              messages.map((msg) => {
                const isMine = msg.sender_id === currentUser?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${
                        isMine
                          ? "bg-blue-600 text-white"
                          : "border border-slate-200 bg-white text-slate-800"
                      }`}
                    >
                      {!isMine && (
                        <p className="text-xs font-semibold text-slate-500">
                          {msg.sender_name || "User"}
                        </p>
                      )}
                      <p
                        className={`text-sm leading-6 whitespace-pre-wrap break-words ${
                          !isMine ? "mt-1" : ""
                        }`}
                      >
                        {msg.body}
                      </p>
                      <p
                        className={`mt-1 text-xs ${
                          isMine ? "text-blue-100" : "text-slate-500"
                        }`}
                      >
                        {formatDateTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                No messages yet. Start the secure conversation for this matter.
              </div>
            )}
          </div>

          <form onSubmit={handleSendMessage} className="border-t border-slate-200 bg-white p-3">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Write a secure message..."
              maxLength={5000}
              className="min-h-[76px] w-full resize-none rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-blue-600"
            />
            {messagesError && messages.length > 0 && (
              <p className="mt-2 text-sm text-red-600">{messagesError}</p>
            )}
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Messages are visible to authorized users on this matter.
              </p>
              <button
                type="submit"
                disabled={sendingMessage || !newMessage.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {sendingMessage ? "Sending..." : "Send Message"}
              </button>
            </div>
          </form>
        </div>
      </section>

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
