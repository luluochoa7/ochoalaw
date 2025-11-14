"use client";

import Navbar from "frontend/src/app/components/Navbar";
import RequireAuth from "frontend/src/app/components/RequireAuth";

export default function LawyerDashboardPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />

        <main className="flex-1 pt-24 px-6">
          {/* Header */}
          <h1 className="text-3xl font-bold text-slate-800 mb-6">
            Lawyer Dashboard
          </h1>

          {/* Content */}
          <div className="space-y-6">
            <section className="p-6 bg-white rounded-xl shadow-md border">
              <h2 className="text-xl font-semibold text-slate-700">
                Welcome Back
              </h2>
              <p className="mt-2 text-slate-600">
                This is your secure lawyer dashboard.  
                More features (client matters, scheduling, uploads) will be added soon.
              </p>
            </section>

            <section className="p-6 bg-white rounded-xl shadow-md border">
              <h2 className="text-lg font-semibold text-slate-700">Next Steps</h2>
              <ul className="mt-3 space-y-2 text-slate-600 list-disc list-inside">
                <li>View messages or requests from clients</li>
                <li>Upload legal documents</li>
                <li>Manage client interactions</li>
                <li>Access scheduling & calendar tools</li>
              </ul>
            </section>
          </div>
        </main>
      </div>
    </RequireAuth>
  );
}