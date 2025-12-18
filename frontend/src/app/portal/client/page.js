"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import RequireAuth from "../../components/RequireAuth";
import { fetchMyMatters, fetchMe } from "../../lib/auth";

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
    <RequireAuth>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />

        <main className="flex-1 mt-16">
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
                  <h2 className="text-lg font-semibold text-slate-900">
                    Your Matters
                  </h2>

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
                      <ul className="divide-y">
                        {matters.map((m) => (
                          <li
                            key={m.id}
                            className="py-3 flex justify-between items-center"
                          >
                            <div>
                              <p className="font-medium text-slate-900">
                                {m.title}
                              </p>
                              <p className="text-xs text-slate-500">
                                Matter #{m.id}
                              </p>
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
                  >
                    Open Inbox
                  </button>
                </div>
              </div>

              {/* Side column */}
              <div className="space-y-6">
                {/* Documents */}
                <div className="rounded-2xl bg-white shadow-xl border p-6">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Documents
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Upload and view files related to your case.
                  </p>
                  <button
                    className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-3 text-white opacity-60 cursor-not-allowed"
                    disabled
                  >
                    Upload coming soon
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </RequireAuth>
  );
}