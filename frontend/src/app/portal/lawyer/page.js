// app/portal/lawyer/page.js
import Navbar from "@/app/components/Navbar";

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-xl">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function LawyerDashboardPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 mt-16">
        {/* Header */}
        <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-black">
          <div className="container mx-auto px-4 py-12">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white">Firm Dashboard</h1>
                <p className="mt-2 text-blue-100">
                  Track matters, intake, billing, and today’s schedule.
                </p>
              </div>
              <div className="flex gap-3">
                <button className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-white hover:bg-white/20">
                  New matter
                </button>
                <button className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-white hover:bg-white/20">
                  Invite client
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="-mt-8 pb-16">
          <div className="container mx-auto px-4 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Stat label="Open matters" value="24" sub="+3 this week" />
              <Stat label="Active clients" value="58" sub="2 new intakes" />
              <Stat label="Unread messages" value="12" sub="5 from today" />
              <Stat label="Unbilled time" value="6.3 h" sub="This week" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Matters table */}
              <div className="lg:col-span-2 rounded-2xl bg-white shadow-xl border p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Recent Matters</h2>
                  <a className="text-sm text-blue-700 hover:underline" href="#">
                    View all
                  </a>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-slate-500">
                      <tr>
                        <th className="py-2 pr-4">Matter</th>
                        <th className="py-2 pr-4">Client</th>
                        <th className="py-2 pr-4">Stage</th>
                        <th className="py-2">Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[
                        ["M-23080", "A. Martinez", "Discovery", "Today"],
                        ["M-23077", "J. Chen", "Drafting", "Yesterday"],
                        ["M-23072", "K. Patel", "Intake", "Oct 21"],
                        ["M-23065", "R. Singh", "Negotiation", "Oct 20"],
                      ].map(([id, client, stage, when]) => (
                        <tr key={id} className="hover:bg-slate-50">
                          <td className="py-3 pr-4 font-medium text-slate-900">{id}</td>
                          <td className="py-3 pr-4">{client}</td>
                          <td className="py-3 pr-4">
                            <span className="rounded-full bg-blue-50 text-blue-700 text-xs px-2.5 py-1">
                              {stage}
                            </span>
                          </td>
                          <td className="py-3">{when}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Today / tasks */}
              <div className="space-y-6">
                <div className="rounded-2xl bg-white shadow-xl border p-6">
                  <h2 className="text-lg font-semibold text-slate-900">Today</h2>
                  <ul className="mt-4 space-y-3 text-sm">
                    <li className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-slate-900">Consultation – A. Martinez</p>
                        <p className="text-slate-600">2:00–2:30 PM • Zoom</p>
                      </div>
                      <button className="text-blue-700 hover:underline">Join</button>
                    </li>
                    <li className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-slate-900">Review NDA – J. Chen</p>
                        <p className="text-slate-600">Due today</p>
                      </div>
                      <button className="text-blue-700 hover:underline">Open</button>
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl bg-white shadow-xl border p-6">
                  <h2 className="text-lg font-semibold text-slate-900">Intake & Inbox</h2>
                  <div className="mt-3 space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="rounded-xl border p-4 hover:bg-slate-50">
                        <p className="text-sm font-medium text-slate-900">
                          New intake: LLC Formation
                        </p>
                        <p className="text-sm text-slate-600">From website form • 15m ago</p>
                      </div>
                    ))}
                  </div>
                  <button className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700">
                    Go to inbox
                  </button>
                </div>
              </div>
            </div>

            {/* Billing row */}
            <div className="rounded-2xl bg-white shadow-xl border p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Billing Overview</h2>
                <a className="text-sm text-blue-700 hover:underline" href="#">
                  Open billing
                </a>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="rounded-xl border p-4">
                  <p className="text-slate-600">This week</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">$1,420</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-slate-600">Unpaid invoices</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">$3,260</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-slate-600">Pending trust transfers</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">$890</p>
                </div>
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