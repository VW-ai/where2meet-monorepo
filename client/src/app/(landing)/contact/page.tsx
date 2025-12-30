import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Mail } from 'lucide-react';
import { createMetadata } from '@/lib/seo/metadata';
import catLogo from '@/components/cat/image.png';

export const metadata: Metadata = createMetadata({
  title: 'Contact Us',
  description:
    "Get in touch with the Where2Meet team. Questions about fair meeting planning, travel time comparison, or feedback? We'd love to hear from you.",
  canonical: '/contact',
  robots: { index: true, follow: true },
});

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-coral-50 via-mint-50 to-lavender-50">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <Image
            src={catLogo}
            alt="Where2Meet Logo"
            width={48}
            height={48}
            className="w-10 h-10 sm:w-12 sm:h-12"
          />
          <span className="text-xl font-bold text-gray-900">Where2Meet</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 md:py-20 max-w-2xl">
        <article className="bg-white rounded-3xl shadow-xl p-8 md:p-12">
          {/* Hero */}
          <header className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Get in Touch</h1>
            <p className="text-xl text-gray-600">
              Have questions, feedback, or suggestions? We'd love to hear from you.
            </p>
          </header>

          {/* Contact Info */}
          <section className="space-y-8">
            {/* Email */}
            <div className="bg-gradient-to-r from-coral-50 to-mint-50 rounded-2xl p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-coral-500 text-white rounded-full mb-4">
                <Mail className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Email Us</h2>
              <a
                href="mailto:contact@wayvi-ai.com"
                className="text-xl text-coral-600 hover:text-coral-700 font-semibold"
              >
                contact@wayvi-ai.com
              </a>
              <p className="text-gray-600 mt-4">
                We typically respond within 24-48 hours during business days.
              </p>
            </div>

            {/* What to Contact About */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">What Can We Help With?</h2>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="text-coral-500 font-bold mt-1">•</span>
                  <div>
                    <strong className="text-gray-900">General Questions:</strong>
                    <span className="text-gray-700">
                      {' '}
                      How Where2Meet works, features, or usage tips
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-coral-500 font-bold mt-1">•</span>
                  <div>
                    <strong className="text-gray-900">Technical Support:</strong>
                    <span className="text-gray-700">
                      {' '}
                      Issues with creating meetings, adding participants, or viewing maps
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-coral-500 font-bold mt-1">•</span>
                  <div>
                    <strong className="text-gray-900">Feature Requests:</strong>
                    <span className="text-gray-700">
                      {' '}
                      Ideas for improvements or new features you'd like to see
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-coral-500 font-bold mt-1">•</span>
                  <div>
                    <strong className="text-gray-900">Business Inquiries:</strong>
                    <span className="text-gray-700">
                      {' '}
                      Partnerships, enterprise use cases, or custom implementations
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-coral-500 font-bold mt-1">•</span>
                  <div>
                    <strong className="text-gray-900">Feedback:</strong>
                    <span className="text-gray-700">
                      {' '}
                      Your experience with Where2Meet, what works well, or what could be better
                    </span>
                  </div>
                </li>
              </ul>
            </div>

            {/* FAQ Link */}
            <div className="bg-lavender-50 rounded-2xl p-6 text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Looking for Quick Answers?
              </h3>
              <p className="text-gray-700 mb-4">
                Check our FAQ page for answers to common questions about fair meeting planning and
                travel time comparison.
              </p>
              <Link
                href="/faq"
                className="inline-block bg-white text-coral-600 px-6 py-3 rounded-full font-semibold hover:bg-gray-50 transition-colors border-2 border-coral-200"
              >
                Visit FAQ
              </Link>
            </div>
          </section>

          {/* About Where2Meet */}
          <section className="mt-12 pt-12 border-t-2 border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">About Where2Meet</h2>
            <p className="text-gray-700 text-center leading-relaxed">
              Where2Meet helps groups find fair meeting locations by comparing real travel times and
              balancing commutes. We're committed to making group planning more equitable and
              transparent—because everyone's time matters.
            </p>
            <div className="text-center mt-6">
              <Link
                href="/how-it-works"
                className="text-coral-600 hover:text-coral-700 font-semibold"
              >
                Learn how it works →
              </Link>
            </div>
          </section>
        </article>

        {/* Footer Navigation */}
        <nav className="mt-8 text-center space-x-6 text-sm">
          <Link href="/" className="text-gray-600 hover:text-gray-900">
            Home
          </Link>
          <Link href="/how-it-works" className="text-gray-600 hover:text-gray-900">
            How It Works
          </Link>
          <Link href="/faq" className="text-gray-600 hover:text-gray-900">
            FAQ
          </Link>
        </nav>
      </main>
    </div>
  );
}
