import Link from "next/link";

export default function ContactUs() {
    return (
        <div className="min-h-screen bg-gray-100">
            {/* Navbar */}
            <header className="bg-gray-800 text-white fixed top-0 left-0 w-full z-50">
                <div className="container mx-auto flex justify-between items-center p-4">
                    {/* Logo */}
                    <div className="text-xl font-bold">
                        <Link href="/">Ochoa Law</Link>
                    </div>

                    {/* Navigation Links */}
                    <nav className="hidden md:flex space-x-6">
                        <ul className="flex space-x-6">
                            <li>
                                <Link href="/" className="hover:text-gray-300">
                                    Home
                                </Link>
                            </li>
                            <li>
                                <Link href="/#about" className="hover:text-gray-300">
                                    About
                                </Link>
                            </li>
                            <li>
                                <Link href="/#services" className="hover:text-gray-300">
                                    Services
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

            {/* Contact Page Content */}
            <div className="mt-20 flex items-center justify-center  p-8">
                <div className="max-w-5xl w-full bg-white shadow-lg rounded-lg overflow-hidden">
                    {/* Header Section */}
                    <div className="bg-blue-500 text-white py-6 px-8 text-center">
                        <h1 className="text-3xl font-bold">Contact Us</h1>
                        <p className="mt-2 text-lg">
                            We’re here to help. Fill out the form below, and we’ll get back to you as soon as possible.
                        </p>
                    </div>

                    {/* Contact Form Section */}
                    <div className="p-8">
                        <form
                            action="https://ochoalaw.onrender.com/contact-us"
                            method="POST"
                            className="space-y-6"
                        >
                            {/* Name Field */}
                            <div>
                                <label
                                    htmlFor="name"
                                    className="block text-sm font-medium text-gray-700"
                                >
                                    Name
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    required
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-300"
                                    placeholder="Your full name"
                                />
                            </div>

                            {/* Email Field */}
                            <div>
                                <label
                                    htmlFor="email"
                                    className="block text-sm font-medium text-gray-700"
                                >
                                    Email
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    required
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-300"
                                    placeholder="Your email address"
                                />
                            </div>

                            {/* Phone Number Field */}
                            <div>
                                <label
                                    htmlFor="phone"
                                    className="block text-sm font-medium text-gray-700"
                                >
                                    Phone Number (Optional)
                                </label>
                                <input
                                    type="tel"
                                    id="phone"
                                    name="phone"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-300"
                                    placeholder="Your phone number"
                                />
                            </div>

                            {/* Message Field */}
                            <div>
                                <label
                                    htmlFor="message"
                                    className="block text-sm font-medium text-gray-700"
                                >
                                    Message
                                </label>
                                <textarea
                                    id="message"
                                    name="message"
                                    required
                                    rows="5"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-300"
                                    placeholder="How can we assist you?"
                                ></textarea>
                            </div>

                            {/* Submit Button */}
                            <div className="text-center">
                                <button
                                    type="submit"
                                    className="w-full sm:w-auto px-6 py-3 bg-blue-500 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm"
                                >
                                    Submit
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Contact Info Section */}
                    <div className="bg-gray-50 py-6 px-8 text-center">
                        <h2 className="text-lg font-bold text-gray-700">
                            Contact Information
                        </h2>
                        <p className="mt-2 text-gray-600">
                            <strong>Phone:</strong> (773) 941-1906
                        </p>
                        <p className="mt-1 text-gray-600">
                            <strong>Email:</strong> ochoajr16@gmail.com
                        </p>
                        <p className="mt-1 text-gray-600">
                            <strong>Address:</strong> 5145 Main Street, Chicago, IL 60601
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}