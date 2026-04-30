import Image from "next/image";
import Link from "next/link";

const practiceAreas = [
  {
    title: "Immigration",
    kicker: "Families, founders, and professionals",
    desc: "Visas, green cards, citizenship, waivers, and removal defense handled with calm preparation and clear next steps.",
  },
  {
    title: "Family Law",
    kicker: "Private matters, steady counsel",
    desc: "Divorce, parenting agreements, custody concerns, and support disputes approached with discretion and durable strategy.",
  },
  {
    title: "Real Estate",
    kicker: "Closings, conflicts, and contracts",
    desc: "Practical guidance for residential and commercial transactions, title issues, negotiations, and property disputes.",
  },
  {
    title: "Personal Injury",
    kicker: "Recovery after serious disruption",
    desc: "Focused advocacy for injured clients navigating medical bills, insurance pressure, and the road back to stability.",
  },
];

const firmStandards = [
  "Direct communication from intake through resolution",
  "Bilingual service for English- and Spanish-speaking clients",
  "Practical strategy built around leverage, timing, and risk",
  "Prepared advocacy in negotiation, filings, and hearings",
];

const clientExperience = [
  {
    title: "A Clear Theory",
    desc: "Every matter begins with the facts, the law, the pressure points, and a plan the client can understand.",
  },
  {
    title: "Measured Pressure",
    desc: "The firm pushes where it matters: clean documentation, firm deadlines, and negotiation posture tied to the end goal.",
  },
  {
    title: "Professional Calm",
    desc: "High-stakes issues are easier to face when the communication is steady, candid, and never needlessly dramatic.",
  },
];

export default function Home() {
  return (
    <div id="home" className="min-h-screen bg-stone-50 text-slate-950">
      <section className="relative isolate flex min-h-[76svh] items-start overflow-hidden bg-slate-950 px-5 pb-12 pt-28 text-white sm:min-h-[78svh] sm:items-center sm:px-8 lg:px-10">
        <Image
          src="/chicago-skyline.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(2,6,23,0.96)_0%,rgba(2,6,23,0.78)_42%,rgba(2,6,23,0.44)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-44 bg-[linear-gradient(0deg,rgba(12,10,9,0.88),rgba(12,10,9,0))]" />

        <div className="mx-auto w-full max-w-7xl">
          <div className="max-w-4xl">
            <p className="mb-5 max-w-max border-l-2 border-amber-400 bg-white/10 px-4 py-2 text-sm font-semibold uppercase text-amber-100 backdrop-blur">
              Chicago legal counsel
            </p>
            <h1 className="text-4xl font-semibold leading-[0.98] text-white sm:text-6xl lg:text-7xl">
              Ochoa Lawyers
            </h1>
            <p className="mt-5 max-w-3xl text-xl font-medium leading-tight text-stone-100 sm:mt-6 sm:text-3xl">
              Premier advocacy for consequential immigration, family, real estate, and injury matters.
            </p>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-stone-300 sm:mt-6 sm:text-lg sm:leading-8">
              A Chicago firm for clients who need thoughtful strategy, disciplined preparation, and a lawyer who can make complex moments feel manageable.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:mt-9 sm:flex-row">
              <Link
                href="/contact-us"
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-amber-400 px-6 py-3 text-sm font-bold uppercase text-slate-950 shadow-[0_16px_42px_rgba(251,191,36,0.22)] hover:bg-amber-300 sm:min-h-12"
              >
                Schedule a Consultation
              </Link>
              <Link
                href="#services"
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/[0.35] px-6 py-3 text-sm font-bold uppercase text-white hover:border-amber-300 hover:text-amber-100 sm:min-h-12"
              >
                Explore Practice Areas
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Firm highlights" className="bg-slate-950 px-5 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid border-y border-white/[0.18] bg-white/[0.04] text-sm text-stone-200 sm:grid-cols-3">
            <div className="px-5 py-5">
              <div className="text-xs font-bold uppercase text-amber-200">Based in</div>
              <div className="mt-1 text-lg font-semibold text-white">Chicago, Illinois</div>
            </div>
            <div className="border-t border-white/[0.14] px-5 py-5 sm:border-l sm:border-t-0">
              <div className="text-xs font-bold uppercase text-amber-200">Practice focus</div>
              <div className="mt-1 text-lg font-semibold text-white">Personal and family stakes</div>
            </div>
            <div className="border-t border-white/[0.14] px-5 py-5 sm:border-l sm:border-t-0">
              <div className="text-xs font-bold uppercase text-amber-200">Service</div>
              <div className="mt-1 text-lg font-semibold text-white">English and Spanish</div>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div className="relative overflow-hidden rounded-lg bg-stone-100 shadow-2xl shadow-slate-950/15">
            <Image
              src="/titoPhoto.png"
              alt="Ochoa Lawyers attorney portrait"
              width={900}
              height={1054}
              priority
              sizes="(min-width: 1024px) 42vw, 100vw"
              className="aspect-[5/6] w-full object-cover object-top"
            />
            <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(15,23,42,0.92),rgba(15,23,42,0))] px-6 pb-6 pt-20 text-white">
              <p className="text-sm font-semibold uppercase text-amber-200">Counsel with presence</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-stone-200">
                Strategic, responsive representation for clients who need clarity before they make the next move.
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm font-bold uppercase text-amber-700">The firm standard</p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">
              Serious legal work should feel composed, prepared, and unmistakably personal.
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-700">
              Ochoa Lawyers pairs a boutique client experience with the polish clients expect from a premier Chicago practice. The work is precise, the communication is human, and the strategy is shaped around what is actually at stake.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {firmStandards.map((item) => (
                <div key={item} className="border-l-2 border-amber-500 bg-white px-5 py-4 shadow-sm shadow-slate-950/5">
                  <p className="text-sm font-semibold leading-6 text-slate-800">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 border-b border-slate-200 pb-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-sm font-bold uppercase text-amber-700">Practice areas</p>
              <h2 className="mt-3 text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">
                Built for the legal moments that change what comes next.
              </h2>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-slate-600 lg:justify-self-end">
              The firm works across personal, family, property, and immigration matters where the right move can protect a future, a home, a business, or a recovery.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {practiceAreas.map((area) => (
              <article
                key={area.title}
                className="group flex min-h-[310px] flex-col justify-between rounded-lg border border-slate-200 bg-stone-50 p-6 shadow-sm shadow-slate-950/5 transition duration-300 hover:-translate-y-1 hover:border-amber-500 hover:bg-white hover:shadow-xl hover:shadow-slate-950/10"
              >
                <div>
                  <p className="text-xs font-bold uppercase text-amber-700">{area.kicker}</p>
                  <h3 className="mt-4 text-2xl font-semibold text-slate-950">{area.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{area.desc}</p>
                </div>
                <Link
                  href="/contact-us"
                  className="mt-8 inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-4 py-3 text-sm font-bold uppercase text-slate-950 group-hover:border-slate-950 group-hover:bg-slate-950 group-hover:text-white"
                >
                  Discuss This Matter
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 px-5 py-20 text-white sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase text-amber-300">Results-minded representation</p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
              Strategy before noise. Preparation before pressure.
            </h2>
            <p className="mt-6 text-lg leading-8 text-stone-300">
              Elite legal service is not louder. It is more organized, more responsive, and more honest about the decisions that matter. Ochoa Lawyers keeps clients oriented while building the strongest available path forward.
            </p>
          </div>

          <div className="grid gap-4">
            {clientExperience.map((item, index) => (
              <div key={item.title} className="grid gap-4 border border-white/[0.12] bg-white/[0.04] p-5 sm:grid-cols-[72px_1fr]">
                <div className="flex h-14 w-14 items-center justify-center rounded-md bg-amber-400 text-lg font-black text-slate-950">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-stone-300">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="portal" className="bg-stone-100 px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-8 border-y border-slate-300 py-12 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase text-amber-700">Secure access</p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">Lawyer and client portal</h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-700">
              A secure space for clients to view matter updates and for the firm to manage communication, documents, and intake workflows.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-950 px-5 py-3 text-sm font-bold uppercase text-slate-950 hover:bg-slate-950 hover:text-white"
              href="/portal?role=lawyer"
            >
              Lawyer Login
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-slate-950 px-5 py-3 text-sm font-bold uppercase text-white hover:bg-slate-800"
              href="/portal?role=client"
            >
              Client Login
            </Link>
          </div>
        </div>
      </section>

      <section id="testimonials" className="bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase text-amber-700">Client experience</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">
              The experience should be as strong as the advocacy.
            </h2>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {[
              "You know what is happening in your matter and why it matters.",
              "Your documents, deadlines, and options are handled with discipline.",
              "Your case gets a strategy built for your life, not a template.",
            ].map((statement) => (
              <div key={statement} className="rounded-lg border border-slate-200 bg-stone-50 p-7">
                <div className="h-1 w-16 bg-amber-500" />
                <p className="mt-6 text-xl font-semibold leading-8 text-slate-900">{statement}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="relative isolate overflow-hidden bg-slate-950 px-5 py-20 text-white sm:px-8 lg:px-10">
        <Image
          src="/chicago-skyline.jpg"
          alt=""
          fill
          sizes="100vw"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center opacity-25"
        />
        <div className="absolute inset-0 -z-10 bg-slate-950/[0.82]" />
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase text-amber-300">Start with clarity</p>
            <h2 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
              Bring the issue. Leave with a plan.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-300">
              Schedule a consultation with Ochoa Lawyers and talk through the facts, the risks, and the smartest next step.
            </p>
          </div>
          <Link
            href="/contact-us"
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-amber-400 px-7 py-4 text-sm font-bold uppercase text-slate-950 shadow-[0_18px_50px_rgba(251,191,36,0.22)] hover:bg-amber-300"
          >
            Contact the Firm
          </Link>
        </div>
      </section>

      <footer className="bg-stone-950 px-5 py-10 text-stone-300 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-6 text-sm md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="font-semibold text-white">Ochoa Lawyers</p>
            <p className="mt-2">Chicago, IL | Immigration, Family, Real Estate, and Personal Injury</p>
          </div>
          <p>&copy; {new Date().getFullYear()} Ochoa Lawyers. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
