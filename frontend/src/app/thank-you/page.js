"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const REDIRECT_SECONDS = 7;

export default function ThankYou() {
  const router = useRouter();
  const [seconds, setSeconds] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((s) => (s > 1 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (seconds === 0) router.push("/");
  }, [seconds, router]);

  return (
    <div className="min-h-screen bg-stone-100 text-slate-950">
      <main className="px-4 pb-16 pt-24 sm:px-6 lg:px-10">
        <section className="mx-auto max-w-6xl overflow-hidden rounded-lg border border-stone-200 bg-white shadow-2xl shadow-slate-950/10">
          <div className="grid min-h-[560px] lg:grid-cols-[0.92fr_1.08fr]">
            <aside className="flex flex-col justify-between bg-stone-50 px-6 py-8 sm:px-10 lg:px-14 lg:py-16">
              <div>
                <Link
                  href="/"
                  className="text-sm font-semibold uppercase text-amber-700 hover:text-amber-800"
                >
                  &larr; Back to home
                </Link>

                <p className="mt-14 text-sm font-bold uppercase text-amber-700">
                  Request Submitted
                </p>
                <h1 className="mt-4 text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">
                  Thank you for reaching out.
                </h1>
                <p className="mt-6 max-w-md text-base leading-8 text-slate-600">
                  We received your message and will review it carefully. Someone from
                  Ochoa Lawyers will follow up about your request.
                </p>
              </div>

              <div className="mt-12 border-t border-stone-300 pt-8">
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
                </dl>
              </div>
            </aside>

            <section className="flex items-center px-6 py-8 sm:px-10 lg:px-14 lg:py-16">
              <div className="mx-auto w-full max-w-xl">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-amber-700">
                  <svg
                    aria-hidden="true"
                    className="h-8 w-8"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                  >
                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                <div className="mt-8 border-b border-slate-200 pb-6">
                  <h2 className="text-2xl font-semibold text-slate-950">
                    Your request is in.
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    You can return home now, or submit another request if there is
                    something else you would like to add.
                  </p>
                </div>

                <div className="mt-8 border-l-2 border-amber-500 pl-4">
                  <p className="text-sm font-semibold text-slate-950">
                    Returning to the homepage in {seconds} second{seconds === 1 ? "" : "s"}.
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Prefer not to wait? Use the links below.
                  </p>
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/"
                    className="inline-flex min-h-11 items-center justify-center rounded-md bg-amber-400 px-7 py-3 text-sm font-bold uppercase text-slate-950 shadow-[0_14px_34px_rgba(251,191,36,0.18)] hover:bg-amber-300"
                  >
                    Go Home
                  </Link>
                  <Link
                    href="/contact-us"
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-7 py-3 text-sm font-bold uppercase text-slate-950 hover:border-slate-950 hover:bg-slate-950 hover:text-white"
                  >
                    Send Another
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="mt-6 text-sm font-medium text-[#245B83] hover:text-[#183F5F] hover:underline"
                >
                  Return now
                </button>
              </div>
            </section>
          </div>
        </section>
      </main>

      <footer className="bg-slate-900 text-slate-300">
        <div className="mx-auto max-w-7xl px-4 py-8 text-center text-sm sm:px-6">
          &copy; {new Date().getFullYear()} Ochoa Lawyers. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
