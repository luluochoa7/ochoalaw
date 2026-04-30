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
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../lib/auth";

function normalizeStatus(s) {
  const val = (s || "").toString().trim();
  if (!val) return "Open";
  return val[0].toUpperCase() + val.slice(1);
}

function statusBadgeClass(status) {
  const s = normalizeStatus(status);
  if (s === "Closed") return "border border-red-200 bg-red-50 text-red-700";
  if (s === "Waiting on Client") return "border border-amber-200 bg-amber-50 text-amber-700";
  if (s === "In Progress") return "border border-green-200 bg-green-50 text-green-700";
  if (s === "Open") return "border border-slate-300 bg-slate-50 text-slate-700";
  return "border border-slate-200 bg-slate-50 text-slate-700";
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

function getErrorMessage(error, fallback) {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (typeof error?.message === "string" && error.message.trim()) return error.message;
  return fallback;
}

function formatNotificationDate(iso) {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getNotificationHref(notification) {
  if (notification.type === "new_message" && notification.matter_id) {
    return `/portal/client/matters/${notification.matter_id}#messages`;
  }
  if (notification.type === "document_uploaded" && notification.matter_id) {
    return `/portal/client/matters/${notification.matter_id}#documents`;
  }
  if (notification.type === "shared_update_added" && notification.matter_id) {
    return `/portal/client/matters/${notification.matter_id}#shared-updates`;
  }
  return "/portal/client";
}

function NotificationsPanel({
  notifications,
  notificationsLoading,
  notificationsError,
  onOpenNotification,
  onMarkAllRead,
}) {
  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <section className="rounded-2xl border bg-white shadow-xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Recent matter activity for you.
          </p>
        </div>
        {hasUnread && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="shrink-0 text-sm font-medium text-slate-700 hover:underline"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="mt-6 max-h-[320px] space-y-3 overflow-y-auto pr-1">
        {notificationsLoading ? (
          <p className="text-sm text-slate-600">Loading notifications...</p>
        ) : notificationsError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {notificationsError}
          </div>
        ) : notifications.length ? (
          notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => onOpenNotification(notification)}
              className={`w-full rounded-xl border p-4 text-left shadow-sm transition hover:bg-slate-100 ${
                notification.is_read
                  ? "border-slate-200 bg-slate-50"
                  : "border-slate-300 bg-slate-50/80"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {notification.title}
                  </p>
                  {notification.body && (
                    <p className="mt-1 break-words text-sm leading-6 text-slate-600">
                      {notification.body}
                    </p>
                  )}
                </div>
                {!notification.is_read && (
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-800" />
                )}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {formatNotificationDate(notification.created_at)}
              </p>
            </button>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            No notifications yet.
          </div>
        )}
      </div>
    </section>
  );
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
    "image/webp",
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

  async function fetchDocumentsForMatter(matterId) {
    const list = await fetchMatterDocuments(matterId);
    return Array.isArray(list) ? list : [];
  }

  // default selected matter when matters load
  useEffect(() => {
    if (!matters?.length) {
      setSelectedMatterId("");
      setDocs([]);
      return;
    }

    const stillExists = matters.some((m) => String(m.id) === selectedMatterId);
    if (!selectedMatterId || !stillExists) {
      setSelectedMatterId(String(matters[0].id));
    }
  }, [matters, selectedMatterId]);

  // load docs when selection changes
  useEffect(() => {
    let cancelled = false;

    async function loadDocs() {
      if (!selectedMatterId) {
        if (!cancelled) setDocs([]);
        return;
      }
      setErr("");
      setDocsLoading(true);
      try {
        const nextDocs = await fetchDocumentsForMatter(selectedMatterId);
        if (!cancelled) setDocs(nextDocs);
      } catch (e) {
        if (!cancelled) setErr(getErrorMessage(e, "Could not load documents."));
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
    setDocsLoading(true);

    try {
      // SINGLE CALL (frontend): handles presign -> PUT -> complete
      await uploadMatterFile(Number(selectedMatterId), file);

      // refresh list
      const nextDocs = await fetchDocumentsForMatter(selectedMatterId);
      setDocs(nextDocs);
      setFile(null);

      // reset the input UI (optional quality of life)
      const el = document.getElementById("client-doc-upload-input");
      if (el) el.value = "";
    } catch (e) {
      console.error(e);
      setErr(getErrorMessage(e, "Upload failed."));
    } finally {
      setBusy(false);
      setDocsLoading(false);
    }
  }

  async function handleOpen(doc) {
    setErr("");
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
      console.error(e);
      const message = getErrorMessage(e, "Could not load document.");
      setPreviewError(message);
      setErr(message);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleDownload(doc) {
    setErr("");
    try {
      const links = await ensureDocumentLinks(doc);
      openDocumentUrl(links?.download_url);
    } catch (e) {
      console.error(e);
      setErr(getErrorMessage(e, "Could not download document."));
    }
  }

  return (
    <section className="rounded-2xl border bg-white shadow-xl p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-slate-900">Documents</h2>

        <div className="w-full sm:w-auto">
          <select
            className="w-full sm:w-[280px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
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

      <p className="mt-2 text-sm text-slate-600 leading-6">
        Upload files into the selected matter and open or download them.
      </p>

      <div className="mt-6 space-y-6">
        <div className="space-y-3">
          <input
            id="client-doc-upload-input"
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setErr("");
              setFile(null);

              if (!f) return;

              if (f.size > MAX_FILE_SIZE) {
                setErr("File must be under 25MB.");
                e.target.value = "";
                return;
              }
              if (f.type && !ALLOWED_TYPES.includes(f.type)) {
                setErr("Unsupported file type. Please upload PDF, DOC, DOCX, JPG, or PNG.");
                e.target.value = "";
                return;
              }
              setFile(f);
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
            className="w-full rounded-lg bg-slate-800 px-4 py-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
            disabled={!selectedMatterId || busy || !file}
            onClick={handleUpload}
            type="button"
          >
            {busy ? "Uploading…" : "Upload document"}
          </button>

          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>

        <div>
          <p className="text-sm font-medium text-slate-900">Uploaded files</p>

          <div className="mt-3 max-h-[260px] overflow-y-auto space-y-3 pr-1">
            {docsLoading ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm text-sm text-slate-600">
                Loading documents...
              </div>
            ) : docs?.length ? (
              docs.map((d) => (
                <div key={d.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 break-words">
                        {d.filename}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Uploaded {d.created_at ? fmtDateTime(d.created_at) : "—"}
                      </p>
                    </div>

                    <div className="mt-3 flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onMouseEnter={() => {
                          if (isPreviewableFile(d.filename)) {
                            void ensureDocumentLinks(d);
                          }
                        }}
                        onClick={() => handleOpen(d)}
                        className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownload(d)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No documents yet.
              </div>
            )}
          </div>
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
                ) : isPreviewableImage(selectedDocument.filename) ? (
                  <img
                    src={documentLinks[selectedDocument.id].content_url}
                    alt={selectedDocument.filename}
                    className="max-h-[700px] w-full rounded-xl border object-contain bg-slate-50"
                  />
                ) : (
                  <p className="text-sm text-slate-500">
                    Open is not available for this file type.
                  </p>
                )
              ) : (
                <p className="text-sm text-slate-500">Open is not available for this file.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function ClientDashboardPage() {
  const router = useRouter();
  const [matters, setMatters] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [mattersLoading, setMattersLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageError, setPageError] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!cancelled) {
        setPageError(null);
        setError(null);
        setMattersLoading(true);
        setNotificationsError("");
        setNotificationsLoading(true);
      }

      try {
        const [meResult, mattersResult, notificationsResult] = await Promise.allSettled([
          fetchMe(true),
          fetchMyMatters(),
          fetchNotifications(),
        ]);

        if (cancelled) return;

        if (
          meResult.status !== "fulfilled" ||
          !meResult.value ||
          meResult.value.role !== "client"
        ) {
          router.push("/portal");
          return;
        }

        if (mattersResult.status === "fulfilled") {
          setMatters(Array.isArray(mattersResult.value) ? mattersResult.value : []);
          setError(null);
        } else {
          setMatters([]);
          setError(getErrorMessage(mattersResult.reason, "Could not load your matters."));
        }

        if (notificationsResult.status === "fulfilled") {
          setNotifications(
            Array.isArray(notificationsResult.value) ? notificationsResult.value : []
          );
          setNotificationsError("");
        } else {
          setNotifications([]);
          setNotificationsError(
            getErrorMessage(notificationsResult.reason, "Could not load notifications.")
          );
        }
      } catch (e) {
        if (!cancelled) {
          setPageError(getErrorMessage(e, "Could not load your dashboard."));
        }
      } finally {
        if (!cancelled) {
          setMattersLoading(false);
          setNotificationsLoading(false);
          setAuthLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleOpenNotification(notification) {
    const href = getNotificationHref(notification);
    try {
      if (!notification.is_read) {
        const updated = await markNotificationRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === updated.id ? updated : n))
        );
      }
      router.push(href);
    } catch (e) {
      console.error(e);
      router.push(href);
    }
  }

  async function handleMarkAllNotificationsRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          is_read: true,
          read_at: n.read_at || new Date().toISOString(),
        }))
      );
    } catch (e) {
      console.error(e);
    }
  }

  if (authLoading) {
    return <div className="mt-24 text-center">Loading your dashboard...</div>;
  }

  return (
    <>
      {/* Header */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-black">
        <div className="container mx-auto max-w-7xl px-4 py-16 text-center">
          <h1 className="text-4xl font-semibold text-white">Your Client Portal</h1>
          <p className="mt-4 text-base text-slate-300 leading-6">
            Everything related to your legal matters — in one secure place.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="-mt-8 pb-16">
        <div className="container mx-auto max-w-7xl px-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {pageError && (
            <div className="lg:col-span-3 rounded-xl border bg-white p-4 text-sm text-red-600">
              {pageError}
            </div>
          )}

          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Matters */}
            <section className="rounded-2xl border bg-white shadow-xl p-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Your Matters</h2>
                <p className="mt-2 text-sm text-slate-600 leading-6">
                  Review updates and open each matter workspace quickly.
                </p>
              </div>

              <div className="mt-6">
                {mattersLoading ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                    Loading…
                  </div>
                ) : error ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-red-600">
                    {error}
                  </div>
                ) : matters.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    You don’t have any active matters yet.
                  </div>
                ) : (
                  <div className="max-h-[340px] overflow-y-auto space-y-3 pr-1">
                    {matters.map((m) => (
                      <Link
                        key={m.id}
                        href={`/portal/client/matters/${m.id}`}
                        prefetch={true}
                        className="block rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition hover:bg-slate-100"
                      >
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {m.title}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Matter #{m.id} • {m.created_at ? fmtDateShort(m.created_at) : "—"}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ${statusBadgeClass(
                              m.status
                            )}`}
                          >
                            {normalizeStatus(m.status)}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Messages */}
            <section className="rounded-2xl border bg-white shadow-xl p-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Secure Messages</h2>
                <p className="mt-2 text-sm text-slate-600 leading-6">
                  Communicate securely with your legal team.
                </p>
              </div>
              <div className="mt-6 space-y-4">
                <button
                  className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
                  onClick={() => alert("Messaging coming soon")}
                  type="button"
                >
                  Open Inbox
                </button>
              </div>
            </section>
          </div>

          {/* Side column */}
          <div className="space-y-6">
            <NotificationsPanel
              notifications={notifications}
              notificationsLoading={notificationsLoading}
              notificationsError={notificationsError}
              onOpenNotification={handleOpenNotification}
              onMarkAllRead={handleMarkAllNotificationsRead}
            />

            {/* Documents (NOW FUNCTIONAL) */}
            <DocumentsPanel matters={matters} loadingMatters={mattersLoading} />
          </div>
        </div>
      </section>
    </>
  );
}
