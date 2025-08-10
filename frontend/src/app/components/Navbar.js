"use client";
import { useState } from "react";
import Link from "next/link";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="bg-gray-800 text-white fixed top-0 left-0 w-full z-50 shadow-md">
      <div className="container mx-auto flex justify-between items-center p-4">
        {/* Logo */}
        <div className="text-xl font-bold">
          <Link href="/">Ochoa &amp; Co.</Link>
        </div>

        {/* Desktop Menu */}
        <nav className="hidden md:flex space-x-6 items-center">
          <Link href="/#about" className="hover:text-blue-300">
            About
          </Link>
          <Link href="/#services" className="hover:text-blue-300">
            Services
          </Link>
          <Link href="/#testimonials" className="hover:text-blue-300">
            Testimonials
          </Link>
          <Link
            href="/portal"
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-indigo-600 hover:to-blue-500 rounded shadow-md transition duration-300"
          >
            Portal
          </Link>
          <Link href="/contact-us" className="hover:text-blue-300">
            Contact
          </Link>
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden focus:outline-none"
          onClick={() => setMenuOpen(!menuOpen)}
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
        <div className="md:hidden bg-gray-700 px-4 pb-4 space-y-2">
          <Link
            href="/#about"
            className="block hover:text-blue-300"
            onClick={() => setMenuOpen(false)}
          >
            About
          </Link>
          <Link
            href="/#services"
            className="block hover:text-blue-300"
            onClick={() => setMenuOpen(false)}
          >
            Services
          </Link>
          <Link
            href="/#testimonials"
            className="block hover:text-blue-300"
            onClick={() => setMenuOpen(false)}
          >
            Testimonials
          </Link>
          <Link
            href="/portal"
            className="block px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-indigo-600 hover:to-blue-500 rounded shadow-md"
            onClick={() => setMenuOpen(false)}
          >
            Portal
          </Link>
          <Link
            href="/contact-us"
            className="block hover:text-blue-300"
            onClick={() => setMenuOpen(false)}
          >
            Contact
          </Link>
        </div>
      )}
    </header>
  );
}