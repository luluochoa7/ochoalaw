import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div id="home" className="min-h-screen flex flex-col">

      {/* Hero */}
      <section
        className="relative text-white min-h-screen flex items-center justify-center"
        style={{
          backgroundImage: "url('/chicago-skyline.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/70" />
        <div className="relative z-10 text-center px-8 max-w-3xl mt-16">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Trusted Legal Counsel for Life’s Most Important Moments
          </h1>
          <p className="text-lg sm:text-xl text-blue-100">
            Clear guidance. Tireless advocacy. Results you can rely on.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link href="/contact-us" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium">
              Schedule a Consultation
            </Link>
            <Link href="#services" className="px-6 py-3 border border-white/40 hover:bg-white/10 rounded font-medium">
              View Services
            </Link>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-16 px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-4">About Ochoa &amp; Co.</h2>
            <p className="text-lg text-slate-700 leading-relaxed">
              With years of experience across immigration, family, real estate, and personal injury law,
              Ochoa &amp; Co. provides personalized counsel with exceptional care. We combine courtroom expertise
              with practical strategy to achieve the best outcomes.
            </p>
            <ul className="mt-6 space-y-2 text-slate-700">
              <li>• Client-first communication</li>
              <li>• Transparent, fair pricing</li>
              <li>• Bilingual support available</li>
            </ul>
          </div>
          <Image
            src="/titoPhoto.png"
            alt="About Ochoa & Co."
            width={560}
            height={380}
            className="rounded-2xl shadow-lg object-cover"
          />
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-16 px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-8">Practice Areas</h2>
          <p className="text-center text-slate-600 max-w-2xl mx-auto">
            Comprehensive support from first consult to resolution.
          </p>

          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { title: "Immigration Law", desc: "Visas, green cards, citizenship, and relief strategies." },
              { title: "Family Law", desc: "Divorce, custody, and agreements tailored to your goals." },
              { title: "Real Estate Law", desc: "Closings, disputes, and zoning with minimal friction." },
              { title: "Personal Injury", desc: "Car accidents, negligence, premises liability, and more." },
            ].map((s) => (
              <div key={s.title} className="bg-white rounded-2xl border p-6 shadow-sm hover:shadow-md transition">
                <h3 className="text-xl font-semibold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Portal */}
      <section id="portal" className="py-16 bg-white border-y">
        <div className="max-w-5xl mx-auto px-8 text-center">
          <h3 className="text-2xl font-semibold text-slate-900">Lawyer & Client Portal</h3>
          <p className="mt-2 text-slate-600">
            Secure login for clients to view their case status and for lawyers to manage intakes.{" "}
            <span className="font-medium">Coming soon.</span>
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <a className="rounded-lg px-5 py-2 border text-slate-800 hover:bg-slate-50" href="/portal?role=lawyer" title="Placeholder">
              Lawyer Login
            </a>
            <a className="rounded-lg px-5 py-2 border text-slate-800 hover:bg-slate-50" href="/portal?role=client" title="Placeholder">
              Client Login
            </a>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-16 px-8 bg-gray-50">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-8">What Clients Say</h2>

          <div className="grid gap-6 md:grid-cols-2 text-left">
            {[1, 2].map((i) => (
              <figure key={i} className="bg-white rounded-2xl border p-8 shadow-sm">
                <div className="flex items-center justify-between">
                  <figcaption className="font-semibold text-slate-900">Tato. Ochoa — Chicago, IL</figcaption>
                  <div className="text-amber-500" aria-label="5 out of 5 stars">
                    {"★".repeat(5)}
                  </div>
                </div>
                <blockquote className="mt-3 text-slate-700 leading-relaxed">
                  “I couldn’t have asked for a better experience. Professional, thorough,
                  and truly cared about my case. Communication was clear and the outcome exceeded expectations.”
                </blockquote>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="py-16 px-8 text-center bg-blue-600 text-white">
        <h2 className="text-3xl font-bold mb-3">Ready to talk?</h2>
        <p className="text-white/90">Get a fast, no-pressure consultation today.</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/contact-us"
            className="inline-block px-6 py-3 bg-white text-blue-700 hover:bg-gray-100 rounded font-medium"
          >
            Go to Contact Form
          </Link>
          <Link
            href="#home"
            className="inline-block px-6 py-3 border border-white/40 hover:bg-white/10 rounded font-medium"
          >
            Back to Top
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-8 text-center">
        <p className="text-sm">&copy; {new Date().getFullYear()} Ochoa &amp; Co. All rights reserved.</p>
      </footer>
    </div>
  );
}