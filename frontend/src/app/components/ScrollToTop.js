"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function scrollToPageTop() {
  const root = document.documentElement;
  const previousScrollBehavior = root.style.scrollBehavior;

  root.style.scrollBehavior = "auto";
  window.scrollTo(0, 0);
  root.style.scrollBehavior = previousScrollBehavior;
}

export default function ScrollToTop() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousUrlRef = useRef(null);
  const currentUrl = `${pathname || ""}?${searchParams?.toString() || ""}`;

  useEffect(() => {
    if (previousUrlRef.current === null) {
      previousUrlRef.current = currentUrl;
      return;
    }

    if (previousUrlRef.current === currentUrl) return;

    previousUrlRef.current = currentUrl;

    if (window.location.hash) return;

    scrollToPageTop();
    const frameId = window.requestAnimationFrame(scrollToPageTop);

    return () => window.cancelAnimationFrame(frameId);
  }, [currentUrl]);

  return null;
}
