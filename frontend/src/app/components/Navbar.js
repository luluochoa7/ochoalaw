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
    <header className="fixed left-0 top-0 z-50 w-full border-b border-slate-800 bg-slate-900/[0.96] text-white shadow-md backdrop-blur">
      <div className="container mx-auto flex items-center justify-between p-4">
        {/* Logo */}
        <div className="text-xl font-bold">
          <Link href="/" className="text-white hover:text-amber-200">
            Ochoa Lawyers
          </Link>
        </div>

        {/* Desktop Menu */}
        <nav className="hidden items-center space-x-6 text-sm font-medium md:flex">
          <Link href="/#about" className="text-stone-200 hover:text-amber-200">
            About
          </Link>
          <Link href="/#services" className="text-stone-200 hover:text-amber-200">
            Services
          </Link>
          <Link href="/#testimonials" className="text-stone-200 hover:text-amber-200">
            Testimonials
          </Link>

          {/* Auth-aware buttons */}
          {!loadingUser && (
            <>
              {!user && (
                <Link
                  href="/portal"
                  className="rounded px-4 py-2 bg-amber-400 text-slate-950 shadow-md transition duration-300 hover:bg-amber-300"
                >
                  Portal
                </Link>
              )}

              {user && (
                <>
                  <Link
                    href={portalHref}
                    className="rounded px-4 py-2 bg-amber-400 text-slate-950 shadow-md transition duration-300 hover:bg-amber-300"
                  >
                    My Portal
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="rounded px-4 py-2 bg-red-600 text-white shadow-md transition hover:bg-red-700"
                  >
                    Logout
                  </button>
                </>
              )}
            </>
          )}

          <Link href="/contact-us" className="text-stone-200 hover:text-amber-200">
            Contact
          </Link>
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="rounded p-1 text-white hover:text-amber-200 md:hidden"
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
        <div className="space-y-2 border-t border-slate-800 bg-slate-800 px-4 pb-4 pt-3 text-sm font-medium md:hidden">
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
            Services
          </Link>
          <Link
            href="/#testimonials"
            className="block text-stone-200 hover:text-amber-200"
            onClick={() => setMenuOpen(false)}
          >
            Testimonials
          </Link>

          {!loadingUser && !user && (
            <Link
              href="/portal"
              className="block rounded px-4 py-2 bg-amber-400 text-slate-950 shadow-md hover:bg-amber-300"
              onClick={() => setMenuOpen(false)}
            >
              Portal
            </Link>
          )}

          {!loadingUser && user && (
            <>
              <Link
                href={portalHref}
                className="block rounded px-4 py-2 bg-amber-400 text-slate-950 shadow-md hover:bg-amber-300"
                onClick={() => setMenuOpen(false)}
              >
                My Portal
              </Link>
              <button
                className="mt-2 block w-full rounded px-4 py-2 text-left bg-red-600 text-white shadow-md hover:bg-red-700"
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
            className="block text-stone-200 hover:text-amber-200"
            onClick={() => setMenuOpen(false)}
          >
            Contact
          </Link>
        </div>
      )}
    </header>
  );
}
