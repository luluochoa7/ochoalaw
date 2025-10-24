// app/portal/client/page.js
import Navbar from "@/app/components/Navbar";

export default function ClientDashboardPage() {
  return (
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
                  <button className="rounded-xl border px-4 py-3 text-slate-800 hover:bg-slate-50">
                    Book appointment
                  </button>
                  <button className="rounded-xl border px-4 py-3 text-slate-800 hover:bg-slate-50">
                    Upload document
                  </button>
                  <button className="rounded-xl border px-4 py-3 text-slate-800 hover:bg-slate-50">
                    Message your lawyer
                  </button>
                </div>
              </div>

              {/* Matters */}
              <div className="rounded-2xl bg-white shadow-xl border p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Your Matters</h2>
                  <a className="text-sm text-blue-700 hover:underline" href="#">
                    View all
                  </a>
                </div>
                <ul className="mt-4 divide-y">
                  {[
                    { id: "M-23014", title: "Lease Review", status: "In Progress" },
                    { id: "M-23027", title: "LLC Formation", status: "Awaiting Docs" },
                    { id: "M-23052", title: "Consultation", status: "Completed" },
                  ].map((m) => (
                    <li key={m.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{m.title}</p>
                        <p className="text-xs text-slate-500">{m.id}</p>
                      </div>
                      <span className="rounded-full bg-blue-50 text-blue-700 text-xs px-3 py-1">
                        {m.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Messages */}
              <div className="rounded-2xl bg-white shadow-xl border p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Messages</h2>
                  <a className="text-sm text-blue-700 hover:underline" href="#">
                    Open inbox
                  </a>
                </div>
                <div className="mt-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-xl border p-4 hover:bg-slate-50">
                      <p className="text-sm font-medium text-slate-900">
                        New update from Ochoa Law
                      </p>
                      <p className="text-sm text-slate-600 truncate">
                        We’ve reviewed your document. Next steps are…
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* Upcoming */}
              <div className="rounded-2xl bg-white shadow-xl border p-6">
                <h2 className="text-lg font-semibold text-slate-900">Upcoming</h2>
                <ul className="mt-4 space-y-3">
                  <li className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-900">Call with Attorney</p>
                      <p className="text-sm text-slate-600">Oct 28, 2:00 PM</p>
                    </div>
                    <button className="text-sm text-blue-700 hover:underline">Join</button>
                  </li>
                  <li className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-900">Doc signature due</p>
                      <p className="text-sm text-slate-600">Oct 30</p>
                    </div>
                    <button className="text-sm text-blue-700 hover:underline">Review</button>
                  </li>
                </ul>
              </div>

              {/* Billing */}
              <div className="rounded-2xl bg-white shadow-xl border p-6">
                <h2 className="text-lg font-semibold text-slate-900">Billing</h2>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-sm text-slate-600">Outstanding balance</p>
                  <p className="font-semibold text-slate-900">$320.00</p>
                </div>
                <button className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700">
                  Make a payment
                </button>
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
  );
}