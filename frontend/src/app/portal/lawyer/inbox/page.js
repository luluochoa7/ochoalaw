"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchLawyerInbox } from "../../../lib/auth";

function fmtDateTime(value) {
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

function getMessagePreview(body) {
  if (!body) return "No message content";
  return body.length > 120 ? `${body.slice(0, 120)}...` : body;
}

function getStatusBadgeClass(status) {
  return `whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
    status === "Closed"
      ? "bg-red-100 text-red-700"
      : status === "Waiting on Client"
      ? "bg-amber-100 text-amber-700"
      : status === "In Progress"
      ? "bg-green-100 text-green-700"
      : "bg-blue-100 text-blue-700"
  }`;
}

export default function LawyerInboxPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadInbox() {
      try {
        setError("");
        setLoading(true);
        const data = await fetchLawyerInbox();
        if (!cancelled) {
          setItems(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError(e?.message || "Failed to load inbox.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInbox();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-100">
      <section className="bg-slate-950">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <Link
            href="/portal/lawyer"
            className="text-sm text-blue-200 hover:text-white"
          >
            Back to dashboard
          </Link>
          <h1 className="mt-4 text-3xl font-semibold text-white">Inbox</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Review recent matter conversations and jump back into secure client communication.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-2xl border bg-white p-6 shadow-xl">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Recent Conversations
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Conversations are organized by matter.
            </p>
          </div>

          <div className="mt-6">
            {loading ? (
              <p className="text-sm text-slate-600">Loading inbox...</p>
            ) : error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : items.length ? (
              <div className="space-y-3">
                {items.map((item) => (
                  <Link
                    key={item.matter_id}
                    href={`/portal/lawyer/matters/${item.matter_id}#messages`}
                    className="block rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition hover:bg-slate-100"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-words text-sm font-semibold text-slate-900">
                            {item.matter_title}
                          </p>
                          <span className={getStatusBadgeClass(item.matter_status)}>
                            {item.matter_status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Client: {item.client_name || "Unassigned"}
                        </p>
                        <p className="mt-3 break-words text-sm leading-6 text-slate-700">
                          <span className="font-medium text-slate-900">
                            {item.latest_message_sender_name || "User"}:
                          </span>{" "}
                          {getMessagePreview(item.latest_message_body)}
                        </p>
                      </div>
                      <p className="shrink-0 text-xs text-slate-500">
                        {fmtDateTime(item.latest_message_created_at)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                No conversations yet. Messages will appear here once clients or lawyers send secure matter messages.
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
