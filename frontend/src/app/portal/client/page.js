"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchClientMatters, fetchMe } from "../../lib/auth";

export default function ClientPortalPage() {
  const router = useRouter();
  const [matters, setMatters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const me = await fetchMe();
        if (me.role !== "client") {
          router.push("/portal"); // fallback
          return;
        }

        const data = await fetchClientMatters();
        setMatters(data);
      } catch (err) {
        console.error(err);
        setError("Could not load your matters.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router]);

  if (loading) return <div className="mt-24 text-center">Loading your portal...</div>;
  if (error) return <div className="mt-24 text-center text-red-600">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 pt-24 px-4">
      <div className="container mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">Welcome to your Client Portal</h1>
        <p className="text-slate-600 mb-8">
          View your matters, upload documents, and message your lawyer securely.
        </p>

        {/* Matters list */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Your Matters</h2>
          {matters.length === 0 ? (
            <p className="text-slate-500 text-sm">
              You don&apos;t have any active matters yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {matters.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between border rounded-lg px-4 py-3"
                >
                  <div>
                    <div className="font-medium">{m.title}</div>
                    {m.description && (
                      <div className="text-sm text-slate-500">{m.description}</div>
                    )}
                  </div>
                  <span className="text-xs uppercase tracking-wide px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                    {m.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Placeholder cards */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-semibold mb-2">Secure Messages</h2>
            <p className="text-sm text-slate-600 mb-3">
              Soon you&apos;ll be able to send secure messages to your lawyer from here.
            </p>
            <button className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm opacity-60 cursor-not-allowed">
              Messaging coming soon
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-semibold mb-2">Upload Documents</h2>
            <p className="text-sm text-slate-600 mb-3">
              Upload and manage documents related to your case.
            </p>
            <button className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm opacity-60 cursor-not-allowed">
              Upload coming soon
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}