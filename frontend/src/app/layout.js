import { Suspense } from "react";
import "./globals.css";
import Navbar from "./components/Navbar";
import ScrollToTop from "./components/ScrollToTop";

export const metadata = {
  title: "Ochoa Lawyers — Chicago Law Firm",
  description:
    "Trusted legal counsel in Personal Injury, Immigration, Family, and Real Estate law. Schedule a consultation with Ochoa Lawyers.",
  metadataBase: new URL("https://ochoalaw.vercel.app"),
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-900 antialiased">
        <Navbar />
        <Suspense fallback={null}>
          <ScrollToTop />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
