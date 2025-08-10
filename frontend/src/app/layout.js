import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Ochoa Law — Chicago Law Firm",
  description:
    "Trusted legal counsel in Personal Injury, Immigration, Family, and Real Estate law. Schedule a consultation with Ochoa Law.",
  metadataBase: new URL("https://ochoalaw.vercel.app"),
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-slate-900`}
      >
        {/* Optional: a global wrapper if I ever need site-wide components */}
        {children}
      </body>
    </html>
  );
}
