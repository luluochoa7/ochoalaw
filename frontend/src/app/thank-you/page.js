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
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-black text-white">

      <main className="flex-1 mt-16 flex items-center justify-center px-4">
        <div className="w-full max-w-2xl">
          {/* Card */}
          <div className="relative rounded-2xl bg-white/5 backdrop-blur border border-white/10 shadow-2xl overflow-hidden">
            {/* Top accent */}
            <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400" />

            <div className="p-8 sm:p-10 text-center">
              {/* Icon */}
              <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center relative">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/20" />
                <svg
                  aria-hidden="true"
                  className="h-8 w-8 text-emerald-300"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Thank you for reaching out!
              </h1>
              <p className="mt-3 text-slate-300">
                We’ve received your message and will get back to you shortly.
              </p>

              {/* Countdown */}
              <div className="mt-6 flex items-center justify-center gap-3">
                <div className="rounded-full bg-white/10 px-4 py-2 text-sm text-slate-200 border border-white/10">
                  Redirecting to the homepage in{" "}
                  <span className="font-semibold text-white">{seconds}</span> sec
                  {seconds === 1 ? "" : "s"}…
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 shadow"
                >
                  Go to Homepage
                </Link>
                <Link
                  href="/contact-us"
                  className="inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-5 py-3 font-medium text-white hover:bg-white/10"
                >
                  Submit Another Inquiry
                </Link>
              </div>
            </div>

            {/* Subtle gradient glow */}
            <div className="pointer-events-none absolute -inset-20 opacity-20 blur-3xl"
                 style={{
                   background:
                     "radial-gradient(600px circle at 50% -10%, rgba(99,102,241,0.35), transparent 60%)"
                 }}
            />
          </div>

          {/* Bottom links */}
          <div className="mt-6 text-center text-sm text-slate-400">
            Prefer not to wait?{" "}
            <button
              onClick={() => router.push("/")}
              className="underline underline-offset-4 hover:text-slate-200"
            >
              Click here to go now
            </button>
            .
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 bg-black/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 text-center text-slate-400 text-sm">
          © {new Date().getFullYear()} Ochoa &amp; Co. All rights reserved.
        </div>
      </footer>
    </div>
  );
}