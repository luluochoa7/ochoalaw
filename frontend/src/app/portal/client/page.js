// app/portal/client/page.js
"use client";

import Navbar from "frontend/src/app/components/Navbar";
import RequireAuth from "frontend/src/app/components/RequireAuth";

export default function ClientDashboardPage() {
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
          {/* (rest of your existing content unchanged) */}
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