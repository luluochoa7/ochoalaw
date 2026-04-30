"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  fetchMe,
  logout,
  AUTH_CHANGED_EVENT,
} from "../lib/auth";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const hasLoadedUserRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let ignore = false;

    async function loadUser(withLoading = !hasLoadedUserRef.current) {
      if (!ignore && withLoading) setLoadingUser(true);
      try {
        const me = await fetchMe(pathname?.startsWith("/portal/"));
        if (!ignore) {
          setUser(me);
        }
      } catch (err) {
        if (!ignore) {
          setUser(null);
        }
      } finally {
        if (!ignore) {
          hasLoadedUserRef.current = true;
          setLoadingUser(false);
        }
      }
    }

    loadUser(!hasLoadedUserRef.current);

    function handleAuthChange(event) {
      if (event?.detail && Object.prototype.hasOwnProperty.call(event.detail, "user")) {
        setUser(event.detail.user || null);
        hasLoadedUserRef.current = true;
        setLoadingUser(false);
        return;
      }
      loadUser(false);
    }

    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChange);

    return () => {
      ignore = true;
      window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChange);
    };
  }, [pathname]);

  const handleLogout = async () => {
    await logout();
    setUser(null);
    router.push("/portal"); // redirect to login screen
  };

  // Decide where "My Portal" should point
  const portalHref = user
    ? user.role === "lawyer"
      ? "/portal/lawyer"
      : "/portal/client"
    : "/portal";

  return (
    <header className="fixed left-0 top-0 z-50 w-full border-b border-white/10 bg-slate-950/[0.92] text-white shadow-xl shadow-slate-950/20 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
        {/* Logo */}
        <div>
          <Link href="/" className="block text-lg font-semibold uppercase text-white">
            Ochoa Lawyers
          </Link>
          <p className="hidden text-xs uppercase text-amber-200 sm:block">Chicago legal counsel</p>
        </div>

        {/* Desktop Menu */}
        <nav className="hidden items-center gap-7 text-sm font-semibold uppercase md:flex">
          <Link href="/#about" className="text-stone-200 hover:text-amber-200">
            About
          </Link>
          <Link href="/#services" className="text-stone-200 hover:text-amber-200">
            Practice Areas
          </Link>
          <Link href="/#testimonials" className="text-stone-200 hover:text-amber-200">
            Experience
          </Link>

          {/* Auth-aware buttons */}
          {!loadingUser && (
            <>
              {!user && (
                <Link
                  href="/portal"
                  className="rounded-md border border-white/20 px-4 py-2 text-white hover:border-amber-300 hover:text-amber-100"
                >
                  Portal
                </Link>
              )}

              {user && (
                <>
                  <Link
                    href={portalHref}
                    className="rounded-md border border-white/20 px-4 py-2 text-white hover:border-amber-300 hover:text-amber-100"
                  >
                    My Portal
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="rounded-md border border-red-400/40 px-4 py-2 text-red-100 transition hover:bg-red-500 hover:text-white"
                  >
                    Logout
                  </button>
                </>
              )}
            </>
          )}

          <Link href="/contact-us" className="rounded-md bg-amber-400 px-4 py-2 text-slate-950 hover:bg-amber-300">
            Contact
          </Link>
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="rounded-md border border-white/20 p-2 text-white md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            {menuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16m-7 6h7"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Dropdown */}
      {menuOpen && (
        <div className="space-y-3 border-t border-white/10 bg-slate-950 px-5 py-5 text-sm font-semibold uppercase md:hidden">
          <Link
            href="/#about"
            className="block text-stone-200 hover:text-amber-200"
            onClick={() => setMenuOpen(false)}
          >
            About
          </Link>
          <Link
            href="/#services"
            className="block text-stone-200 hover:text-amber-200"
            onClick={() => setMenuOpen(false)}
          >
            Practice Areas
          </Link>
          <Link
            href="/#testimonials"
            className="block text-stone-200 hover:text-amber-200"
            onClick={() => setMenuOpen(false)}
          >
            Experience
          </Link>

          {!loadingUser && !user && (
            <Link
              href="/portal"
              className="block rounded-md border border-white/20 px-4 py-3 text-white hover:border-amber-300 hover:text-amber-100"
              onClick={() => setMenuOpen(false)}
            >
              Portal
            </Link>
          )}

          {!loadingUser && user && (
            <>
              <Link
                href={portalHref}
                className="block rounded-md border border-white/20 px-4 py-3 text-white hover:border-amber-300 hover:text-amber-100"
                onClick={() => setMenuOpen(false)}
              >
                My Portal
              </Link>
              <button
                className="mt-2 block w-full rounded-md border border-red-400/40 px-4 py-3 text-left text-red-100 hover:bg-red-500 hover:text-white"
                onClick={() => {
                  handleLogout();
                  setMenuOpen(false);
                }}
              >
                Logout
              </button>
            </>
          )}

          <Link
            href="/contact-us"
            className="block rounded-md bg-amber-400 px-4 py-3 text-slate-950 hover:bg-amber-300"
            onClick={() => setMenuOpen(false)}
          >
            Contact
          </Link>
        </div>
      )}
    </header>
  );
}
