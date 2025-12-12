"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import RequireAuth from "../../components/RequireAuth";
import { fetchClientMatters, fetchMe } from "../../lib/auth";

export default function ClientDashboardPage() {
  const router = useRouter();

  const [matters, setMatters] = useState([]);
  const [loadingMatters, setLoadingMatters] = useState(true);
  const [mattersError, setMattersError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const me = await fetchMe();

        // Role gate
        if (me?.role !== "client") {
          router.push("/portal");
          return;
        }

        const data = await fetchClientMatters();
        if (!cancelled) setMatters(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        if (!cancelled) setMattersError("Could not load your matters.");
      } finally {
        if (!cancelled) setLoadingMatters(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <RequireAuth>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />

        <main className="flex-1 mt-16">
          {/* Header */}
          <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-black">
            <div className="container mx-auto px-4 py-12 text-center">
              <h1 className="text-3xl md:text-4xl font-bold text-white">
                Welcome to your Client Portal
              </h1>
              <p className="mt-3 text-blue-100">
                View your matters, upload documents, and message your lawyer securely.
              </p>
            </div>
          </section>

          {/* Content */}
          <section className="-mt-8 pb-16">
            <div className="container mx-auto px-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Quick actions */}
                <div className="rounded-2xl bg-white shadow-xl border p-6">
                  <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      className="rounded-xl border px-4 py-3 text-slate-800 hover:bg-slate-50"
                      type="button"
                      onClick={() => alert("Appointments coming soon.")}
                    >
                      Book appointment
                    </button>
                    <button
                      className="rounded-xl border px-4 py-3 text-slate-800 hover:bg-slate-50"
                      type="button"
                      onClick={() => alert("Document uploads coming soon.")}
                    >
                      Upload document
                    </button>
                    <button
                      className="rounded-xl border px-4 py-3 text-slate-800 hover:bg-slate-50"
                      type="button"
                      onClick={() => alert("Secure messaging coming soon.")}
                    >
                      Message your lawyer
                    </button>
                  </div>
                </div>

                {/* Matters */}
                <div className="rounded-2xl bg-white shadow-xl border p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">Your Matters</h2>
                    <button
                      className="text-sm text-blue-700 hover:underline"
                      type="button"
                      onClick={() => alert("Matter detail pages coming soon.")}
                    >
                      View all
                    </button>
                  </div>

                  <div className="mt-4">
                    {loadingMatters ? (
                      <p className="text-sm text-slate-600">Loading your matters...</p>
                    ) : mattersError ? (
                      <p className="text-sm text-red-600">{mattersError}</p>
                    ) : matters.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        You don&apos;t have any active matters yet.
                      </p>
                    ) : (
                      <ul className="divide-y">
                        {matters.map((m) => (
                          <li key={m.id} className="py-3 flex items-center justify-between">
                            <div>
                              <p className="font-medium text-slate-900">{m.title}</p>
                              {m.description ? (
                                <p className="text-xs text-slate-500">{m.description}</p>
                              ) : (
                                <p className="text-xs text-slate-500">Matter #{m.id}</p>
                              )}
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

                {/* Secure Messages */}
                <div className="rounded-2xl bg-white shadow-xl border p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">Secure Messages</h2>
                    <button
                      className="text-sm text-blue-700 hover:underline"
                      type="button"
                      onClick={() => alert("Inbox coming soon.")}
                    >
                      Open inbox
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    Secure messaging is next — you&apos;ll see conversations with your lawyer here.
                  </p>
                  <button
                    className="mt-4 rounded-lg bg-slate-900 text-white px-4 py-2 text-sm opacity-60 cursor-not-allowed"
                    type="button"
                    disabled
                  >
                    Messaging coming soon
                  </button>
                </div>
              </div>

              {/* Right column */}
              <div className="space-y-6">
                {/* Upload Documents */}
                <div className="rounded-2xl bg-white shadow-xl border p-6">
                  <h2 className="text-lg font-semibold text-slate-900">Upload Documents</h2>
                  <p className="mt-3 text-sm text-slate-600">
                    Upload and manage documents related to your case.
                  </p>
                  <button
                    className="mt-4 w-full rounded-lg bg-slate-900 text-white px-4 py-3 text-sm opacity-60 cursor-not-allowed"
                    type="button"
                    disabled
                  >
                    Upload coming soon
                  </button>
                </div>

                {/* Optional: simple “Account” card (helps UX) */}
                <div className="rounded-2xl bg-white shadow-xl border p-6">
                  <h2 className="text-lg font-semibold text-slate-900">Account</h2>
                  <p className="mt-3 text-sm text-slate-600">
                    You&apos;re signed in. Use the Portal link in the navbar to return here anytime.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="bg-slate-900 text-slate-300">
          <div className="container mx-auto px-4 py-8 text-center">
            <p className="text-sm">© {new Date().getFullYear()} Ochoa &amp; Co.</p>
          </div>
        </footer>
      </div>
    </RequireAuth>
  );
}