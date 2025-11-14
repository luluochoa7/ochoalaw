"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMe } from "@/lib/auth";

export default function RequireAuth({ children }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await fetchMe();
        if (!cancelled) setChecking(false);
      } catch (err) {
        console.error("Auth check failed", err);
        if (!cancelled) router.replace("/portal");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-[50vh] grid place-items-center text-slate-600">
        Checking your session…
      </div>
    );
  }

  return <>{children}</>;
}