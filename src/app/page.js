import Image from "next/image";
import Link from 'next/link'

export default function Home() {
  return (
      <div className="min-h-screen flex flex-col">
        {/* Navbar */}
        <header className="bg-gray-800 text-white fixed top-0 left-0 w-full z-50">
          <div className="container mx-auto flex justify-between items-center p-4">
            {/* Logo */}
            <div className="text-xl font-bold">
              <Link href="#home">Ochoa Law</Link>
            </div>

            {/* Navigation Links */}
            <nav className="hidden md:flex space-x-6">
              <ul className="flex space-x-6">
                <li>
                  <Link href="#about" className="hover:text-gray-300">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="#services" className="hover:text-gray-300">
                    Services
                  </Link>
                </li>
                <li>
                  <Link href="#testimonials" className="hover:text-gray-300">
                    Testimonials
                  </Link>
                </li>
                <li>
                  <Link href="/contact-us" className="hover:text-gray-300">
                    Contact
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </header>

        {/* Hero Section with Chicago Skyline */}
        <section
            id="home"
            className="relative bg-gray-800 text-white min-h-screen flex items-center justify-center"
            style={{
              backgroundImage: "url('/chicago-skyline.jpg')", // Add skyline photo to /public folder
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
        >
          <div className="bg-black/50 w-full h-full absolute top-0 left-0"></div>
          <div className="relative z-10 text-center px-8">
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              Welcome to Ochoa Law
            </h1>
            <p className="text-lg sm:text-xl">
              Providing professional and reliable legal services tailored to your needs.
            </p>
            <Link href={"/contact-us"}>
              <button className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium">
                Schedule a Consultation
              </button>
            </Link>
          </div>
        </section>

        {/* About Section with Photo */}
        <section id="about" className="py-16 px-8 bg-gray-100">
          <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold text-blue-800 mb-4">About Us</h2>
              <p className="text-lg text-gray-700">
                With years of experience in various areas of law, Ochoa Law Firm is
                committed to ensuring justice and providing personalized legal advice.
              </p>
            </div>
            <Image
                src="/about-photo.jpg" // Add an image to /public folder
                alt="About Us"
                width={500}
                height={350}
                className="rounded shadow-lg"
            />
          </div>
        </section>

        {/* Services Section */}
        <section id="services" className="py-16 px-8">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-blue-800 mb-8">Our Services</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="bg-white shadow-lg p-6 rounded">
                <h3 className="text-xl font-semibold text-blue-800 mb-2">Immigration Law</h3>
                <p className="text-gray-600">
                  Legal guidance for any immigration related issues.
                </p>
              </div>
              <div className="bg-white shadow-lg p-6 rounded">
                <h3 className="text-xl font-semibold text-blue-800 mb-2">Family Law</h3>
                <p className="text-gray-600">
                  Support for families in need, including divorce, custody, and adoption cases.
                </p>
              </div>
              <div className="bg-white shadow-lg p-6 rounded">
                <h3 className="text-xl font-semibold text-blue-800 mb-2">Real Estate Law</h3>
                <p className="text-gray-600">
                  Expert advice on property transactions, disputes, and zoning regulations.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="py-16 px-8 bg-gray-100">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-blue-800 mb-8">What Our Clients Say</h2>
            <blockquote className="text-lg text-gray-700 italic">
              I couldn’t have asked for a better experience. Humberto Ochoa was professional, thorough, and truly cared about my case.
            </blockquote>
            <p className="mt-4 font-semibold">- Bernie Sanders</p>
          </div>
        </section>

        {/* Contact Section with External Link */}
        <section id="contact" className="py-16 px-8 text-center bg-blue-600 text-white">
          <h2 className="text-3xl font-bold mb-4">Let Us Help You</h2>
          <p className="text-lg">
            Contact us today to schedule your consultation and take the first step toward resolving your legal matters.
          </p>
          <Link
              href="/contact-us"
              className="mt-6 inline-block px-6 py-3 bg-white text-blue-600 hover:bg-gray-200 rounded font-medium"
          >
            Contact Us
          </Link>
        </section>

        {/* Footer */}
        <footer className="bg-gray-800 text-white py-8 text-center">
          <p>&copy; {new Date().getFullYear()} Ochoa Law Firm. All rights reserved.</p>
        </footer>
      </div>
  );
}