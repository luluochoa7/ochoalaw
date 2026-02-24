import Link from "next/link";

export default function ContactUs() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50" id="top">
      {/* Header band — classic vibe */}
      <section className="mt-16 bg-gradient-to-br from-slate-900 via-slate-800 to-black">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14 text-center">
          <h1 className="text-4xl font-bold text-white">Contact Us</h1>
          <p className="mt-3 text-blue-100">
            We’re here to help. Fill out the form and we’ll get back to you shortly.
          </p>
        </div>
      </section>

      {/* Form card */}
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 -mt-10 pb-16">
          <div className="rounded-2xl bg-white shadow-xl border">
            <div className="p-6 sm:p-10">
              <form
                action="https://ochoalaw.onrender.com/contact"
                method="POST"
                className="space-y-6"
              >
                {/* keep names/ids exact so backend keeps working */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-800">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    autoComplete="name"
                    className="mt-2 block w-full rounded-lg border-slate-300 bg-white px-4 py-3 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                    placeholder="Your full name"
                  />
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-800">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      autoComplete="email"
                      className="mt-2 block w-full rounded-lg border-slate-300 bg-white px-4 py-3 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                      placeholder="you@example.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-slate-800">
                      Phone (optional)
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      autoComplete="tel"
                      className="mt-2 block w-full rounded-lg border-slate-300 bg-white px-4 py-3 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                      placeholder="(555) 555-5555"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-slate-800">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    className="mt-2 block w-full rounded-lg border-slate-300 bg-white px-4 py-3 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                    placeholder="How can we assist you?"
                  />
                </div>

                {/* Honeypot (ignored by backend, reduces spam) */}
                <input type="text" name="_gotcha" className="hidden" tabIndex={-1} autoComplete="off" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <p className="text-sm text-slate-500">
                    By submitting, you agree that Ochoa Lawyers may contact you about your request.
                  </p>
                  <button
                    type="submit"
                    className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700"
                  >
                    Submit
                  </button>
                </div>
              </form>
            </div>

            {/* Contact info strip */}
            <div className="bg-gray-50 border-t">
              <div className="px-6 sm:px-10 py-6 grid gap-4 sm:grid-cols-3 text-sm">
                <div>
                  <div className="font-semibold text-slate-800">Phone</div>
                  <div className="text-slate-600">(773) 941-1906</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-800">Email</div>
                  <div className="text-slate-600">ochoajr16@gmail.com</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-800">Address</div>
                  <div className="text-slate-600">5145 Main Street, Chicago, IL 60601</div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom links */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="/" className="text-slate-700 hover:text-slate-900 underline underline-offset-4">
              ← Back to Home
            </Link>
            <Link href="#top" className="text-slate-700 hover:text-slate-900 underline underline-offset-4">
              Back to Top ↑
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 text-center">
          <p className="text-sm">© {new Date().getFullYear()} Ochoa Lawyers. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
