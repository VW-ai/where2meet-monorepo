import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { createFeaturePageMetadata } from '@/lib/seo/metadata';
import catLogo from '@/components/cat/image.png';

export const metadata: Metadata = createFeaturePageMetadata({
  title: 'How Where2Meet Works – Fair Meeting Location with Travel Time Comparison',
  description:
    'Learn how Where2Meet calculates fair meeting locations by comparing real travel times, balancing commutes, and visualizing group meeting points on a map.',
  canonical: '/how-it-works',
  keywords: [
    'how meeting planner works',
    'fair meeting calculation',
    'travel time balance',
    'group meeting optimization',
  ],
});

export default function HowItWorksPage() {
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
      <main className="container mx-auto px-4 py-12 md:py-20 max-w-4xl">
        <article className="bg-white rounded-3xl shadow-xl p-8 md:p-12 space-y-12">
          {/* Hero */}
          <header className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              How Where2Meet Finds the Fairest Meeting Location
            </h1>
            <p className="text-xl text-gray-600">
              Stop making one person travel twice as far. Find meeting spots that respect everyone's
              time.
            </p>
          </header>

          {/* Section 1: The Problem */}
          <section>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Why Finding a Fair Meeting Spot Is Hard
            </h2>
            <div className="prose prose-lg max-w-none text-gray-700">
              <p>
                We've all been there. You're organizing a group meetup, and someone suggests a
                location that's "pretty central." But when everyone arrives, you realize:
              </p>
              <ul className="space-y-2">
                <li>
                  <strong>Unequal travel times:</strong> Sarah drove 10 minutes while Tom spent 45
                  minutes on public transit
                </li>
                <li>
                  <strong>One person always loses:</strong> The "central" spot is actually closest
                  to whoever suggested it
                </li>
                <li>
                  <strong>Manual map switching:</strong> Checking routes one by one across different
                  apps is exhausting
                </li>
                <li>
                  <strong>Group frustration:</strong> "Next time, can we meet somewhere fair?"
                </li>
              </ul>
              <p className="font-semibold text-coral-600 mt-6">
                The real problem? Most tools show you distance, not fairness.
              </p>
            </div>
          </section>

          {/* Section 2: What Fair Means */}
          <section className="bg-mint-50 rounded-2xl p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              What Does a Fair Meeting Location Mean?
            </h2>
            <div className="prose prose-lg max-w-none text-gray-700">
              <p>
                A <strong>fair meeting location</strong> isn't just about finding the geographic
                midpoint. It's about balancing everyone's <em>actual travel burden</em>.
              </p>
              <div className="bg-white rounded-xl p-6 my-6 border-l-4 border-coral-500">
                <p className="font-semibold text-lg mb-2">Equal Commute Philosophy</p>
                <p className="mb-0">
                  If Alice travels 20 minutes and Bob travels 25 minutes, that's fair. If Alice
                  travels 10 minutes and Bob travels 50 minutes, that's not.
                </p>
              </div>
              <p>
                Where2Meet optimizes for <strong>travel time balance</strong>, not just distance.
                This means:
              </p>
              <ul>
                <li>Real-world commute times (driving, transit, walking)</li>
                <li>Traffic and route complexity considered</li>
                <li>Visual comparison so you can see the tradeoffs</li>
              </ul>
            </div>
          </section>

          {/* Section 3: How It Works */}
          <section>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              How Where2Meet Calculates the Optimal Meeting Point
            </h2>
            <div className="prose prose-lg max-w-none text-gray-700">
              <p>Our algorithm is designed to be both powerful and transparent:</p>

              <div className="space-y-6 my-8">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-coral-500 text-white rounded-full flex items-center justify-center font-bold text-xl">
                    1
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Participants Enter Their Locations
                    </h3>
                    <p>
                      Everyone adds their starting point—home address, office, or current location.
                      You can add as many participants as you need.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-coral-500 text-white rounded-full flex items-center justify-center font-bold text-xl">
                    2
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Travel Times Are Calculated
                    </h3>
                    <p>
                      Where2Meet queries real routing data to get accurate travel times for each
                      participant to potential meeting spots. We consider driving, public transit,
                      and walking.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-coral-500 text-white rounded-full flex items-center justify-center font-bold text-xl">
                    3
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Time-Balanced Point Is Found
                    </h3>
                    <p>
                      Our algorithm finds locations where total travel time is minimized{' '}
                      <em>and</em> balanced across all participants. No one person should bear an
                      unfair burden.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-coral-500 text-white rounded-full flex items-center justify-center font-bold text-xl">
                    4
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Visual Map Shows Tradeoffs
                    </h3>
                    <p>
                      You see everyone's location, travel routes, and venue options on an
                      interactive map. Vote on the best spot together and make an informed group
                      decision.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Travel Time vs Distance */}
          <section className="bg-lavender-50 rounded-2xl p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Why Travel Time Matters More Than Distance
            </h2>
            <div className="prose prose-lg max-w-none text-gray-700">
              <p>
                Here's a common mistake: picking the geographic midpoint. It sounds fair, but it
                often isn't.
              </p>

              <div className="bg-white rounded-xl p-6 my-6">
                <p className="font-semibold text-lg mb-3">Example: The Midpoint Myth</p>
                <p className="mb-2">
                  Alex lives in downtown (well-connected by transit). Jamie lives in the suburbs
                  (car-dependent).
                </p>
                <p className="mb-0">
                  The geographic midpoint might be 5 miles from each person. But Alex can get there
                  in 15 minutes by train, while Jamie needs 35 minutes in traffic.{' '}
                  <strong>That's not fair.</strong>
                </p>
              </div>

              <p>Where2Meet solves this by optimizing for:</p>
              <ul>
                <li>
                  <strong>Real commute times</strong> (not crow-flies distance)
                </li>
                <li>
                  <strong>Transportation mode</strong> (driving vs transit vs walking)
                </li>
                <li>
                  <strong>Route complexity</strong> (highways vs side streets, train transfers,
                  etc.)
                </li>
              </ul>

              <p className="font-semibold text-coral-600 mt-6">
                Fairness is about time, not miles.
              </p>
            </div>
          </section>

          {/* Section 5: Use Cases */}
          <section>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Who Is Where2Meet For?</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Friends Meeting in a City
                </h3>
                <p className="text-gray-700">
                  Find a restaurant, café, or park that's fair for everyone. No more "let's just
                  meet at my place."
                </p>
              </div>

              <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Remote Teams & Offsites
                </h3>
                <p className="text-gray-700">
                  Plan team gatherings, workshops, or hybrid meetups where everyone travels a fair
                  distance.
                </p>
              </div>

              <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Cross-City Group Meetups
                </h3>
                <p className="text-gray-700">
                  Organizing a meetup with people from different neighborhoods or cities? Find the
                  optimal central location.
                </p>
              </div>

              <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Dating & Social Groups</h3>
                <p className="text-gray-700">
                  Meeting someone new? Pick a spot that's equally convenient for both of you—no
                  awkward "you pick" back-and-forth.
                </p>
              </div>
            </div>

            <div className="mt-8 prose prose-lg max-w-none">
              <p>
                <Link href="/" className="text-coral-600 hover:text-coral-700 font-semibold">
                  Learn more on our homepage
                </Link>{' '}
                or{' '}
                <Link href="/faq" className="text-coral-600 hover:text-coral-700 font-semibold">
                  check out our FAQ
                </Link>
                .
              </p>
            </div>
          </section>

          {/* Section 6: CTA */}
          <section className="bg-gradient-to-r from-coral-500 to-coral-600 rounded-2xl p-8 md:p-12 text-center text-white">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Try It Yourself — Find a Fair Meeting Spot in Seconds
            </h2>
            <p className="text-xl mb-8 opacity-95">
              No signup required. Add participants, compare routes, and decide together.
            </p>
            <Link
              href="/"
              className="inline-block bg-white text-coral-600 px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-50 transition-colors shadow-lg"
            >
              Start Planning Now
            </Link>
          </section>
        </article>

        {/* Footer Navigation */}
        <nav className="mt-8 text-center space-x-6 text-sm">
          <Link href="/" className="text-gray-600 hover:text-gray-900">
            Home
          </Link>
          <Link href="/faq" className="text-gray-600 hover:text-gray-900">
            FAQ
          </Link>
          <Link href="/contact" className="text-gray-600 hover:text-gray-900">
            Contact
          </Link>
        </nav>
      </main>
    </div>
  );
}
