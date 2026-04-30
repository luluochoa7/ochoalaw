"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchMe,
  fetchMyMatters,
  createMatter,
  createClientInvitation,
  searchClients,
  uploadMatterFile,
  fetchMatterDocuments,
  getDocumentAccessLinks,
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../lib/auth";

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-xl">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

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

function getNotificationHref(notification, role = "lawyer") {
  const base = role === "client" ? "/portal/client" : "/portal/lawyer";
  if (notification.type === "new_message" && notification.matter_id) {
    return role === "lawyer"
      ? `${base}/inbox?matterId=${notification.matter_id}`
      : `${base}/matters/${notification.matter_id}#messages`;
  }
  if (notification.type === "document_uploaded" && notification.matter_id) {
    return `${base}/matters/${notification.matter_id}#documents`;
  }
  if (notification.type === "shared_update_added" && notification.matter_id) {
    return `${base}/matters/${notification.matter_id}#shared-updates`;
  }
  return base;
}

function NotificationsPanel({
  notifications,
  notificationsLoading,
  notificationsError,
  onOpenNotification,
  onMarkAllRead,
}) {
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const hasUnread = unreadCount > 0;

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-xl">
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

      <div className="mt-6 max-h-[360px] space-y-3 overflow-y-auto pr-1">
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
                  <p className="mt-2 text-xs text-slate-500">
                    {formatNotificationDate(notification.created_at)}
                  </p>
                </div>
                {!notification.is_read && (
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-800" />
                )}
              </div>
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

      const nextDocs = await fetchDocumentsForMatter(selectedMatterId);
      setDocs(nextDocs);
      setFile(null);

      const el = document.getElementById("lawyer-doc-upload-input");
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
            id="lawyer-doc-upload-input"
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

export default function LawyerDashboardPage() {
  const router = useRouter();
  const [checkingRole, setCheckingRole] = useState(true);
  const [pageError, setPageError] = useState(null);

  const [matters, setMatters] = useState([]);
  const [mattersLoading, setMattersLoading] = useState(true);
  const [mattersError, setMattersError] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState("");

  // create matter modal + fields
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [title, setTitle] = useState("");
  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState([]);
  const [clientSearching, setClientSearching] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [description, setDescription] = useState("");

  // invite client modal + fields
  const [showInvite, setShowInvite] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  useEffect(() => {
    let cancelled = false;

    const q = clientQuery.trim();
    if (!q) {
      setClientResults([]);
      setClientSearching(false);
      return;
    }

    async function run() {
      setClientSearching(true);
      try {
        const results = await searchClients(q);
        if (!cancelled) setClientResults(Array.isArray(results) ? results : []);
      } catch (e) {
        if (!cancelled) setClientResults([]);
      } finally {
        if (!cancelled) setClientSearching(false);
      }
    }

    const t = setTimeout(run, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [clientQuery]);

  useEffect(() => {
    let cancelled = false;

    async function gateAndLoad() {
      if (!cancelled) {
        setPageError(null);
        setMattersError(null);
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
          meResult.value.role !== "lawyer"
        ) {
          router.push("/portal");
          return;
        }

        if (mattersResult.status === "fulfilled") {
          setMatters(Array.isArray(mattersResult.value) ? mattersResult.value : []);
          setMattersError(null);
        } else {
          setMatters([]);
          setMattersError(
            getErrorMessage(mattersResult.reason, "Could not load matters.")
          );
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
          setCheckingRole(false);
        }
      }
    }

    gateAndLoad();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const stats = useMemo(() => {
    const total = matters.length;
    const open = matters.filter((m) => {
      const s = (m.status || "").toLowerCase();
      return s !== "closed" && s !== "complete" && s !== "completed";
    }).length;

    return { total, open };
  }, [matters]);

  async function handleCreateMatter(e) {
    e.preventDefault();
    setCreateError(null);

    const t = title.trim();
    const desc = description.trim();

    if (!t || !selectedClient?.id) {
      setCreateError("Title and client selection are required.");
      return;
    }

    setCreateLoading(true);
    try {
      const created = await createMatter({
        title: t,
        client_id: selectedClient.id,
        description: desc || null,
      });

      setMatters((prev) => [created, ...prev]);

      setTitle("");
      setClientQuery("");
      setClientResults([]);
      setSelectedClient(null);
      setDescription("");
      setShowCreate(false);
    } catch (err) {
      console.error(err);
      setCreateError(err?.message || "Failed to create matter.");
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleInviteClient(e) {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess("");

    const name = inviteName.trim();
    const email = inviteEmail.trim().toLowerCase();

    if (!name || !email) {
      setInviteError("Client name and email are required.");
      return;
    }

    setInviteLoading(true);
    try {
      await createClientInvitation({ name, email });
      setInviteSuccess(`Invitation sent to ${email}.`);
      setInviteName("");
      setInviteEmail("");
    } catch (err) {
      console.error(err);
      setInviteError(err?.message || "Failed to send invitation.");
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleOpenNotification(notification) {
    const href = getNotificationHref(notification, "lawyer");
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

  if (checkingRole) {
    return <div className="mt-24 text-center">Loading your dashboard...</div>;
  }

  return (
    <>
      {/* Header */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-black">
        <div className="container mx-auto max-w-7xl px-4 py-16">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold text-white">
              Firm Dashboard
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-300 leading-6">
              Track matters, intake, billing, and today’s schedule.
            </p>
            <div className="mt-6 flex items-center gap-3 flex-wrap">
              <button
                className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
                type="button"
                onClick={() => {
                  setCreateError(null);
                  setShowCreate(true);
                }}
              >
                New matter
              </button>
              <button
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                type="button"
                onClick={() => {
                  setInviteError(null);
                  setInviteSuccess("");
                  setShowInvite(true);
                }}
              >
                Invite client
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="-mt-8 pb-16">
        <div className="container mx-auto max-w-7xl px-4 space-y-6">
          {pageError && (
            <div className="rounded-xl border bg-white p-4 text-sm text-red-600">
              {pageError}
            </div>
          )}

          {/* Stats (now real) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Stat
              label="Open matters"
              value={String(stats.open)}
              sub={`Total: ${stats.total}`}
            />
            <Stat label="Active clients" value="—" sub="Hook to users table next" />
            <Stat label="Unread messages" value="—" sub="Messaging coming soon" />
            <Stat label="Unbilled time" value="—" sub="Time tracking coming soon" />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
            {/* Matters */}
            <section className="xl:col-span-2 rounded-2xl border bg-white shadow-xl p-6">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Recent Matters</h2>
                  <p className="mt-2 text-sm text-slate-600 leading-6">
                    Review recent activity and jump into any matter quickly.
                  </p>
                </div>
                <button
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  type="button"
                  onClick={() => {
                    setCreateError(null);
                    setShowCreate(true);
                  }}
                >
                  Create new
                </button>
              </div>

              <div className="mt-6">
                {mattersLoading ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                    Loading matters…
                  </div>
                ) : mattersError ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-red-600">
                    {mattersError}
                  </div>
                ) : matters.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    No matters yet. Click <span className="font-medium">Create new</span> to add one.
                  </div>
                ) : (
                  <div className="max-h-[340px] overflow-y-auto space-y-3 pr-1">
                    {matters.map((m) => (
                      <Link
                        key={m.id}
                        href={`/portal/lawyer/matters/${m.id}`}
                        prefetch={true}
                        className="block rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition hover:bg-slate-100"
                      >
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {m.title || `Matter #${m.id}`}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              #{m.id} • {m.client_name || `Client ${m.client_id ?? "—"}`} •{" "}
                              {m.created_at ? fmtDateShort(m.created_at) : "—"}
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

            {/* Right rail */}
            <div className="space-y-6">
              <NotificationsPanel
                notifications={notifications}
                notificationsLoading={notificationsLoading}
                notificationsError={notificationsError}
                onOpenNotification={handleOpenNotification}
                onMarkAllRead={handleMarkAllNotificationsRead}
              />

              <section className="rounded-2xl border bg-white p-6 shadow-xl">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Inbox & Communication
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Review secure conversations across active matters.
                  </p>
                </div>
                <Link
                  href="/portal/lawyer/inbox"
                  className="mt-6 flex w-full justify-center rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
                >
                  Open Inbox
                </Link>
              </section>
            </div>
          </div>

          {/* Documents (NOW FUNCTIONAL) */}
          <DocumentsPanel matters={matters} loadingMatters={mattersLoading} />
        </div>
      </section>

      <footer className="bg-slate-900 text-slate-300">
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-sm">© {new Date().getFullYear()} Ochoa &amp; Co.</p>
        </div>
      </footer>

      {/* Create Matter Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border p-6 relative">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>

            <h2 className="text-xl font-semibold text-slate-800 text-center">
              Create a new matter
            </h2>
            <p className="mt-2 text-sm text-slate-600 text-center">
              Search and assign this matter to an existing client.
            </p>

            <form className="mt-5 space-y-4" onSubmit={handleCreateMatter}>
              <div>
                <label className="block text-sm font-medium text-slate-800">
                  Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  type="text"
                  required
                  className="mt-2 w-full rounded-lg border-slate-300 px-4 py-3 shadow-sm focus:border-slate-700 focus:ring-slate-700"
                  placeholder="e.g., Lease Review"
                />
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-slate-800">
                  Client
                </label>

                {selectedClient ? (
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {selectedClient.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {selectedClient.email}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-sm text-slate-700 hover:underline"
                      onClick={() => {
                        setSelectedClient(null);
                        setClientQuery("");
                        setClientResults([]);
                      }}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      value={clientQuery}
                      onChange={(e) => setClientQuery(e.target.value)}
                      type="text"
                      className="mt-2 w-full rounded-lg border-slate-300 px-4 py-3 shadow-sm focus:border-slate-700 focus:ring-slate-700"
                      placeholder="Search by name or email..."
                    />

                    {(clientSearching ||
                      clientResults.length > 0 ||
                      clientQuery.trim()) && (
                      <div className="absolute z-50 mt-2 w-full rounded-xl border bg-white shadow-xl overflow-hidden">
                        {clientSearching ? (
                          <div className="p-3 text-sm text-slate-600">
                            Searching...
                          </div>
                        ) : clientResults.length ? (
                          clientResults.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              className="w-full text-left px-4 py-3 hover:bg-slate-50"
                              onClick={() => {
                                setSelectedClient(c);
                                setClientQuery("");
                                setClientResults([]);
                              }}
                            >
                              <p className="text-sm font-medium text-slate-900">
                                {c.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {c.email}
                              </p>
                            </button>
                          ))
                        ) : (
                          <div className="p-3 text-sm text-slate-600">
                            No matching clients.
                          </div>
                        )}
                      </div>
                    )}

                    <p className="mt-2 text-xs text-slate-500">
                      Client must already have an account. Use "Invite client" for new clients.
                    </p>
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-800">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-lg border-slate-300 px-4 py-3 shadow-sm focus:border-slate-700 focus:ring-slate-700"
                  placeholder="Add a short note about the matter…"
                />
              </div>

              {createError && <p className="text-sm text-red-600">{createError}</p>}

              <button
                type="submit"
                disabled={createLoading}
                className="w-full rounded-lg bg-slate-800 px-4 py-3 font-medium text-white hover:bg-slate-700 disabled:opacity-60"
              >
                {createLoading ? "Creating…" : "Create matter"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Invite Client Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border p-6 relative">
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>

            <h2 className="text-xl font-semibold text-slate-800 text-center">
              Invite a new client
            </h2>
            <p className="mt-2 text-sm text-slate-600 text-center">
              Send a secure portal invitation so the client can set a password.
            </p>

            <form className="mt-5 space-y-4" onSubmit={handleInviteClient}>
              <div>
                <label className="block text-sm font-medium text-slate-800">
                  Client name
                </label>
                <input
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  type="text"
                  required
                  className="mt-2 w-full rounded-lg border-slate-300 px-4 py-3 shadow-sm focus:border-slate-700 focus:ring-slate-700"
                  placeholder="e.g., Jane Client"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-800">
                  Client email
                </label>
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  type="email"
                  required
                  className="mt-2 w-full rounded-lg border-slate-300 px-4 py-3 shadow-sm focus:border-slate-700 focus:ring-slate-700"
                  placeholder="client@example.com"
                />
              </div>

              {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
              {inviteSuccess && <p className="text-sm text-green-600">{inviteSuccess}</p>}

              <button
                type="submit"
                disabled={inviteLoading}
                className="w-full rounded-lg bg-slate-800 px-4 py-3 font-medium text-white hover:bg-slate-700 disabled:opacity-60"
              >
                {inviteLoading ? "Sending..." : "Send invitation"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
