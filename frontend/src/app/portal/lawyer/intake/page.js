"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  convertIntakeToMatter,
  fetchLawyerIntakeSubmissions,
  fetchMe,
  updateIntakeSubmissionStatus,
} from "../../../lib/auth";

const STATUS_LABELS = {
  new: "New",
  reviewing: "Reviewing",
  contacted: "Contacted",
  converted: "Converted",
  closed: "Closed",
  spam: "Spam",
};

const STATUS_ACTIONS = [
  { status: "reviewing", label: "Mark Reviewing" },
  { status: "contacted", label: "Mark Contacted" },
  { status: "closed", label: "Close" },
  { status: "spam", label: "Spam" },
];

function getErrorMessage(error, fallback) {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function formatDateTime(value) {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getPreview(value) {
  if (!value) return "No description provided";
  return value.length > 140 ? `${value.slice(0, 140)}...` : value;
}

function getStatusLabel(status) {
  return STATUS_LABELS[status] || status || "Unknown";
}

function getStatusBadgeClass(status) {
  if (status === "converted") {
    return "border border-green-200 bg-green-50 text-green-700";
  }
  if (status === "contacted" || status === "reviewing") {
    return "border border-[#B9CEDD] bg-[#EEF5FA] text-[#245B83]";
  }
  if (status === "closed") {
    return "border border-slate-200 bg-slate-100 text-slate-700";
  }
  if (status === "spam") {
    return "border border-red-200 bg-red-50 text-red-700";
  }
  return "border border-amber-200 bg-amber-50 text-amber-700";
}

function buildMatterTitle(intake) {
  if (!intake) return "";
  const prefix = intake.matter_type?.trim() || "Matter";
  const name = intake.name?.trim() || "New Client";
  return `${prefix} - ${name}`.slice(0, 200);
}

function IntakeCard({ intake, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(intake.id)}
      className={`block w-full rounded-xl border p-4 text-left shadow-sm transition ${
        selected
          ? "border-[#245B83] bg-[#EEF5FA]"
          : "border-slate-200 bg-slate-50 hover:bg-slate-100"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-words text-sm font-semibold text-slate-900">
              {intake.name}
            </p>
            <span
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${getStatusBadgeClass(
                intake.status
              )}`}
            >
              {getStatusLabel(intake.status)}
            </span>
          </div>
          <p className="mt-1 break-words text-xs text-slate-500">
            {intake.email}
          </p>
        </div>
        <p className="shrink-0 text-xs text-slate-500">
          {formatDateTime(intake.created_at)}
        </p>
      </div>

      {intake.matter_type ? (
        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
          {intake.matter_type}
        </p>
      ) : null}
      <p className="mt-2 break-words text-sm leading-6 text-slate-700">
        {getPreview(intake.description)}
      </p>
    </button>
  );
}

function IntakeList({
  submissions,
  selectedId,
  loading,
  error,
  onSelect,
}) {
  return (
    <section className="flex h-[calc(100dvh-220px)] min-h-[420px] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm lg:h-[700px]">
      <div className="border-b border-slate-200 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Intake Queue</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          New inquiries from the public website.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <p className="text-sm text-slate-600">Loading intake...</p>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : submissions.length ? (
          <div className="space-y-3">
            {submissions.map((intake) => (
              <IntakeCard
                key={intake.id}
                intake={intake}
                selected={selectedId === intake.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            No intake submissions yet.
          </div>
        )}
      </div>
    </section>
  );
}

function DetailRow({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm leading-6 text-slate-900">
        {value || "-"}
      </p>
    </div>
  );
}

export default function LawyerIntakePage() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusSaving, setStatusSaving] = useState("");
  const [actionError, setActionError] = useState("");
  const [convertTitle, setConvertTitle] = useState("");
  const [convertDescription, setConvertDescription] = useState("");
  const [sendInvitation, setSendInvitation] = useState(true);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState("");

  const selectedSubmission = useMemo(
    () => submissions.find((item) => item.id === selectedId) || null,
    [submissions, selectedId]
  );
  const hasSelectedSubmission = Boolean(selectedSubmission);

  useEffect(() => {
    let cancelled = false;

    async function loadIntake() {
      if (!cancelled) {
        setLoading(true);
        setError("");
      }

      try {
        const me = await fetchMe(true);
        if (cancelled) return;

        if (!me || me.role !== "lawyer") {
          router.push("/portal");
          return;
        }

        const data = await fetchLawyerIntakeSubmissions();
        if (cancelled) return;

        const items = Array.isArray(data) ? data : [];
        setSubmissions(items);
        setSelectedId((current) =>
          current && items.some((item) => item.id === current)
            ? current
            : items[0]?.id || null
        );
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setSubmissions([]);
          setSelectedId(null);
          setError(getErrorMessage(e, "Failed to load intake submissions."));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadIntake();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!selectedSubmission) {
      setConvertTitle("");
      setConvertDescription("");
      setConvertError("");
      setActionError("");
      return;
    }

    setConvertTitle(buildMatterTitle(selectedSubmission));
    setConvertDescription((selectedSubmission.description || "").slice(0, 1000));
    setSendInvitation(true);
    setConvertError("");
    setActionError("");
  }, [selectedSubmission]);

  async function refreshSubmissions(nextSelectedId = selectedId) {
    const data = await fetchLawyerIntakeSubmissions();
    const items = Array.isArray(data) ? data : [];
    setSubmissions(items);
    setSelectedId(
      nextSelectedId && items.some((item) => item.id === nextSelectedId)
        ? nextSelectedId
        : items[0]?.id || null
    );
    return items;
  }

  async function handleStatusChange(nextStatus) {
    if (!selectedSubmission || statusSaving) return;

    setStatusSaving(nextStatus);
    setActionError("");
    try {
      const updated = await updateIntakeSubmissionStatus(
        selectedSubmission.id,
        nextStatus
      );
      setSubmissions((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (e) {
      console.error(e);
      setActionError(getErrorMessage(e, "Failed to update status."));
    } finally {
      setStatusSaving("");
    }
  }

  async function handleConvert(e) {
    e.preventDefault();
    if (!selectedSubmission || converting) return;

    const title = convertTitle.trim();
    const description = convertDescription.trim();
    if (!title) {
      setConvertError("Matter title is required.");
      return;
    }

    setConverting(true);
    setConvertError("");
    try {
      const result = await convertIntakeToMatter(selectedSubmission.id, {
        matter_title: title,
        matter_description: description || null,
        send_invitation: sendInvitation,
      });
      const matterId = result?.matter?.id;
      if (matterId) {
        router.push(`/portal/lawyer/matters/${matterId}`);
        return;
      }
      await refreshSubmissions(selectedSubmission.id);
    } catch (e) {
      console.error(e);
      setConvertError(getErrorMessage(e, "Failed to convert intake."));
    } finally {
      setConverting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link
                href="/portal/lawyer"
                className="inline-flex text-sm text-[#245B83] hover:text-[#183F5F] hover:underline"
              >
                &larr; Back to dashboard
              </Link>
              <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Lead review
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950">
                Intake
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Review public inquiries, manage status, and convert qualified leads into matters.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div
            className={`lg:col-span-4 ${
              hasSelectedSubmission ? "hidden lg:block" : "block"
            }`}
          >
            <IntakeList
              submissions={submissions}
              selectedId={selectedId}
              loading={loading}
              error={error}
              onSelect={setSelectedId}
            />
          </div>

          <div
            className={`lg:col-span-8 ${
              hasSelectedSubmission ? "block" : "hidden lg:block"
            }`}
          >
            <section className="flex h-[calc(100dvh-220px)] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:h-[700px]">
              {!selectedSubmission ? (
                <div className="grid flex-1 place-items-center p-6 text-center">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Select an intake submission
                    </h2>
                    <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                      Inquiry details and conversion controls will appear here.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="border-b border-slate-200 p-4 sm:p-6">
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="mb-4 text-sm font-medium text-[#245B83] hover:text-[#183F5F] hover:underline lg:hidden"
                    >
                      &larr; Back to queue
                    </button>

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="break-words text-2xl font-semibold text-slate-950">
                            {selectedSubmission.name}
                          </h2>
                          <span
                            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${getStatusBadgeClass(
                              selectedSubmission.status
                            )}`}
                          >
                            {getStatusLabel(selectedSubmission.status)}
                          </span>
                        </div>
                        <p className="mt-2 break-words text-sm text-slate-600">
                          {selectedSubmission.email}
                        </p>
                      </div>
                      {selectedSubmission.converted_matter_id ? (
                        <Link
                          href={`/portal/lawyer/matters/${selectedSubmission.converted_matter_id}`}
                          className="inline-flex justify-center rounded-lg bg-[#245B83] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#183F5F]"
                        >
                          Open Matter
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <DetailRow label="Phone" value={selectedSubmission.phone} />
                      <DetailRow
                        label="Matter type"
                        value={selectedSubmission.matter_type}
                      />
                      <DetailRow
                        label="Submitted"
                        value={formatDateTime(selectedSubmission.created_at)}
                      />
                      <DetailRow
                        label="Updated"
                        value={formatDateTime(selectedSubmission.updated_at)}
                      />
                    </div>

                    <div className="mt-6">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Description
                      </p>
                      <p className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800">
                        {selectedSubmission.description}
                      </p>
                    </div>

                    <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Status
                      </h3>
                      <div className="mt-4 flex flex-wrap gap-3">
                        {STATUS_ACTIONS.map((action) => (
                          <button
                            key={action.status}
                            type="button"
                            onClick={() => handleStatusChange(action.status)}
                            disabled={
                              statusSaving === action.status ||
                              selectedSubmission.status === action.status ||
                              selectedSubmission.status === "converted"
                            }
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {statusSaving === action.status
                              ? "Saving..."
                              : action.label}
                          </button>
                        ))}
                      </div>
                      {actionError ? (
                        <p className="mt-3 text-sm text-red-600">{actionError}</p>
                      ) : null}
                    </div>

                    <form
                      onSubmit={handleConvert}
                      className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          Convert to Matter
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          Create the matter workspace and optionally send portal access.
                        </p>
                      </div>

                      <div className="mt-5 space-y-4">
                        <div>
                          <label
                            htmlFor="matter-title"
                            className="block text-sm font-medium text-slate-800"
                          >
                            Matter Title
                          </label>
                          <input
                            id="matter-title"
                            value={convertTitle}
                            onChange={(e) => setConvertTitle(e.target.value)}
                            maxLength={200}
                            disabled={Boolean(selectedSubmission.converted_matter_id)}
                            className="mt-2 w-full rounded-lg border-slate-300 px-4 py-3 shadow-sm focus:border-[#245B83] focus:ring-[#245B83] disabled:bg-slate-100"
                            placeholder="Personal Injury - John Smith"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="matter-description"
                            className="block text-sm font-medium text-slate-800"
                          >
                            Matter Description
                          </label>
                          <textarea
                            id="matter-description"
                            value={convertDescription}
                            onChange={(e) => setConvertDescription(e.target.value)}
                            maxLength={1000}
                            rows={5}
                            disabled={Boolean(selectedSubmission.converted_matter_id)}
                            className="mt-2 w-full rounded-lg border-slate-300 px-4 py-3 text-sm leading-6 shadow-sm focus:border-[#245B83] focus:ring-[#245B83] disabled:bg-slate-100"
                          />
                        </div>

                        <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={sendInvitation}
                            onChange={(e) => setSendInvitation(e.target.checked)}
                            disabled={Boolean(selectedSubmission.converted_matter_id)}
                            className="mt-1 rounded border-slate-300 text-[#245B83] focus:ring-[#245B83]"
                          />
                          <span>
                            Send secure portal invitation after conversion
                          </span>
                        </label>
                      </div>

                      {convertError ? (
                        <p className="mt-4 text-sm text-red-600">{convertError}</p>
                      ) : null}

                      <button
                        type="submit"
                        disabled={converting || Boolean(selectedSubmission.converted_matter_id)}
                        className="mt-5 w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-medium text-white hover:bg-[#245B83] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {selectedSubmission.converted_matter_id
                          ? "Already Converted"
                          : converting
                          ? "Converting..."
                          : "Convert to Matter"}
                      </button>
                    </form>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
