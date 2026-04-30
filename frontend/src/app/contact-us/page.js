"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { submitContactForm } from "../lib/auth";

export default function ContactUs() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError("");

    const form = e.currentTarget;
    const formData = new FormData(form);

    const honeypot = String(formData.get("_gotcha") || "").trim();
    if (honeypot) {
      router.push("/thank-you");
      return;
    }

    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const matterType = String(formData.get("matter_type") || "").trim();
    const message = String(formData.get("message") || "").trim();

    if (!name || !email || !message) {
      setSubmitError("Name, email, and message are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitContactForm({ name, email, phone, matterType, message });
      router.push("/thank-you");
    } catch (err) {
      setSubmitError(err?.message || "Failed to submit the form.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-100 text-slate-950" id="top">
      <main className="px-4 pb-16 pt-24 sm:px-6 lg:px-10">
        <section className="mx-auto max-w-6xl overflow-hidden rounded-lg border border-stone-200 bg-white shadow-2xl shadow-slate-950/10">
          <div className="grid min-h-[620px] lg:grid-cols-[0.92fr_1.08fr]">
            <aside className="flex flex-col justify-between bg-stone-50 px-6 py-8 sm:px-10 lg:px-14 lg:py-16">
              <div>
                <Link
                  href="/"
                  className="text-sm font-semibold uppercase text-amber-700 hover:text-amber-800"
                >
                  &larr; Back to home
                </Link>

                <p className="mt-14 text-sm font-bold uppercase text-amber-700">
                  Contact Ochoa Lawyers
                </p>
                <h1 className="mt-4 text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">
                  Let&apos;s talk through the next move.
                </h1>
                <p className="mt-6 max-w-md text-base leading-8 text-slate-600">
                  Tell us what is happening, what is urgent, and how we can reach you.
                  We will review your request and follow up with a clear next step.
                </p>
              </div>

              <div className="mt-12 space-y-8">
                <div className="border-t border-stone-300 pt-8">
                  <h2 className="text-sm font-bold uppercase text-slate-500">
                    Firm Contact
                  </h2>
                  <dl className="mt-5 space-y-5 text-sm">
                    <div>
                      <dt className="font-semibold text-slate-950">Phone</dt>
                      <dd className="mt-1 text-slate-600">
                        <a href="tel:+17739411906" className="hover:text-[#245B83]">
                          (773) 941-1906
                        </a>
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-950">Email</dt>
                      <dd className="mt-1 break-words text-slate-600">
                        <a href="mailto:ochoajr16@gmail.com" className="hover:text-[#245B83]">
                          ochoajr16@gmail.com
                        </a>
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-950">Office</dt>
                      <dd className="mt-1 text-slate-600">
                        5145 Main Street, Chicago, IL 60601
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="border-l-2 border-amber-500 pl-4">
                  <h2 className="text-sm font-semibold text-slate-950">
                    Helpful to include
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Matter type, important dates, and the best time to contact you.
                  </p>
                </div>
              </div>
            </aside>

            <section className="px-6 py-8 sm:px-10 lg:px-14 lg:py-16">
              <div className="mx-auto max-w-xl">
                <div className="border-b border-slate-200 pb-6">
                  <h2 className="text-2xl font-semibold text-slate-950">
                    Send a Request
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Name, email, and message are required.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="mt-8 space-y-6">
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
                      className="mt-2 block w-full border-b border-slate-300 bg-transparent px-0 py-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-[#245B83] focus:ring-0"
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
                        className="mt-2 block w-full border-b border-slate-300 bg-transparent px-0 py-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-[#245B83] focus:ring-0"
                        placeholder="you@example.com"
                      />
                    </div>

                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-slate-800">
                        Phone <span className="font-normal text-slate-500">(optional)</span>
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        autoComplete="tel"
                        className="mt-2 block w-full border-b border-slate-300 bg-transparent px-0 py-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-[#245B83] focus:ring-0"
                        placeholder="(555) 555-5555"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="matter_type" className="block text-sm font-medium text-slate-800">
                      Matter type <span className="font-normal text-slate-500">(optional)</span>
                    </label>
                    <input
                      type="text"
                      id="matter_type"
                      name="matter_type"
                      autoComplete="off"
                      className="mt-2 block w-full border-b border-slate-300 bg-transparent px-0 py-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-[#245B83] focus:ring-0"
                      placeholder="Personal injury, family, business..."
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-slate-800">
                      Message
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      rows={6}
                      className="mt-2 block min-h-[160px] w-full resize-y rounded-md border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-950 shadow-sm placeholder:text-slate-400 focus:border-[#245B83] focus:ring-[#245B83]"
                      placeholder="Briefly describe the situation, deadline, or question."
                    />
                  </div>

                  <input
                    type="text"
                    name="_gotcha"
                    className="hidden"
                    tabIndex={-1}
                    autoComplete="off"
                  />

                  {submitError ? (
                    <div
                      className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                      role="alert"
                    >
                      {submitError}
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="max-w-sm text-xs leading-5 text-slate-500">
                      By submitting, you agree that Ochoa Lawyers may contact you about your request.
                    </p>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex min-h-11 items-center justify-center rounded-md bg-amber-400 px-7 py-3 text-sm font-bold uppercase text-slate-950 shadow-[0_14px_34px_rgba(251,191,36,0.18)] hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting ? "Submitting..." : "Send Request"}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          </div>
        </section>
      </main>

      <footer className="bg-slate-900 text-slate-300">
        <div className="mx-auto max-w-7xl px-4 py-8 text-center sm:px-6">
          <p className="text-sm">
            &copy; {new Date().getFullYear()} Ochoa Lawyers. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
