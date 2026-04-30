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
    const message = String(formData.get("message") || "").trim();

    if (!name || !email || !message) {
      setSubmitError("Name, email, and message are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitContactForm({ name, email, phone, message });
      router.push("/thank-you");
    } catch (err) {
      setSubmitError(err?.message || "Failed to submit the form.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950" id="top">
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="max-w-3xl">
            <Link
              href="/"
              className="text-sm font-medium text-[#245B83] hover:text-[#183F5F] hover:underline"
            >
              &larr; Back to home
            </Link>
            <h1 className="mt-3 text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
              Contact Us
            </h1>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Share the essentials about your legal matter. The firm will review your request
              and follow up with the next step.
            </p>
          </div>

          <span className="rounded-full border border-[#B9CEDD] bg-[#EEF5FA] px-3 py-1 text-sm font-medium text-[#245B83]">
            New consultation request
          </span>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-2xl border bg-white p-6 shadow-xl sm:p-8">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Start the Conversation
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Name, email, and message are required.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
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
                  className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#245B83] focus:ring-[#245B83]"
                  placeholder="Your full name"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
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
                    className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#245B83] focus:ring-[#245B83]"
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
                    className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#245B83] focus:ring-[#245B83]"
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
                  rows={7}
                  className="mt-2 block min-h-[180px] w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#245B83] focus:ring-[#245B83]"
                  placeholder="Tell us what happened, what deadline is coming up, or what kind of help you need."
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
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  role="alert"
                >
                  {submitError}
                </div>
              ) : null}

              <div className="flex flex-col gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-xl text-sm leading-6 text-slate-500">
                  By submitting, you agree that Ochoa Lawyers may contact you about your request.
                </p>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#245B83] px-5 py-3 text-sm font-medium text-white hover:bg-[#183F5F] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </section>

          <aside className="space-y-6">
            <section className="rounded-2xl border bg-white p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-slate-900">Firm Contact</h2>
              <div className="mt-5 divide-y divide-slate-200 text-sm">
                <div className="py-3 first:pt-0">
                  <p className="font-semibold text-slate-900">Phone</p>
                  <p className="mt-1 text-slate-600">(773) 941-1906</p>
                </div>
                <div className="py-3">
                  <p className="font-semibold text-slate-900">Email</p>
                  <p className="mt-1 break-words text-slate-600">ochoajr16@gmail.com</p>
                </div>
                <div className="py-3 last:pb-0">
                  <p className="font-semibold text-slate-900">Address</p>
                  <p className="mt-1 text-slate-600">5145 Main Street, Chicago, IL 60601</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[#B9CEDD] bg-[#EEF5FA] p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Helpful Details</h2>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
                <li className="border-l-2 border-[#245B83] pl-3">
                  The type of matter you need help with
                </li>
                <li className="border-l-2 border-[#245B83] pl-3">
                  Any important dates, notices, or deadlines
                </li>
                <li className="border-l-2 border-[#245B83] pl-3">
                  The best way and time to reach you
                </li>
              </ul>
            </section>
          </aside>
        </div>
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
