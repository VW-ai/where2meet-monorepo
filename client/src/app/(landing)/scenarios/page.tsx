import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { createMetadata } from '@/lib/seo/metadata';
import { SCENARIO_METADATA } from './data/scenarios';
import catLogo from '@/components/cat/image.png';

/**
 * Generate metadata for scenarios hub page
 */
export const metadata: Metadata = createMetadata({
  title: 'Fair Meeting Scenarios - Where2Meet Use Cases',
  description:
    'Discover how Where2Meet helps find fair meeting locations for friends, teams, families, and more. Compare travel times and find equitable meeting spots for any scenario.',
  canonical: '/scenarios',
  robots: { index: true, follow: true },
  keywordsFocus: 'features',
});

/**
 * Group scenarios by layer for better organization
 */
const SCENARIO_GROUPS = {
  everyday: {
    title: 'Everyday Meetups',
    description: 'Common social and casual meeting scenarios',
    icon: '🍽️',
    scenarios: [
      'friends-group-dinner-spot',
      'date-night-equal-distance',
      'coworkers-lunch-spot',
      'group-weekend-hangout',
      'family-reunion-location-finder',
    ],
  },
  professional: {
    title: 'Professional & Business',
    description: 'Team collaboration and client meetings',
    icon: '💼',
    scenarios: ['remote-team-offsite-planning', 'cross-city-client-meetings'],
  },
  distance: {
    title: 'Long Distance Coordination',
    description: 'Planning meetups across cities and regions',
    icon: '🗺️',
    scenarios: ['long-distance-friends-reunion'],
  },
};

export default function ScenariosPage() {
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
      <main className="container mx-auto px-4 py-12 md:py-20 max-w-6xl">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Fair Meeting Scenarios
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Discover how Where2Meet helps you find equitable meeting locations for any situation.
            Every scenario focuses on <strong>fairness through travel time comparison</strong>, not
            just geographic midpoints.
          </p>
          <Link
            href="/"
            className="inline-block bg-coral-500 text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-coral-600 transition-colors shadow-lg"
          >
            Start Planning Your Meetup
          </Link>
        </div>

        {/* Scenario Groups */}
        <div className="space-y-12">
          {Object.entries(SCENARIO_GROUPS).map(([groupKey, group]) => (
            <section key={groupKey}>
              <div className="flex items-center gap-3 mb-6">
                <span className="text-4xl">{group.icon}</span>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">{group.title}</h2>
                  <p className="text-gray-600">{group.description}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {group.scenarios.map((slug) => {
                  const metadata = SCENARIO_METADATA[slug];
                  if (!metadata) return null;

                  return (
                    <Link
                      key={slug}
                      href={`/scenarios/${slug}`}
                      className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow border-2 border-transparent hover:border-coral-300"
                    >
                      <div className="mb-3">
                        <span className="inline-block px-3 py-1 bg-coral-100 text-coral-700 text-sm font-semibold rounded-full">
                          {metadata.layer === 'layer1-everyday'
                            ? 'Popular'
                            : metadata.layer === 'layer2-pain-heavy'
                              ? 'Professional'
                              : 'Specialty'}
                        </span>
                      </div>

                      <h3 className="text-xl font-bold text-gray-900 mb-3">
                        {slug
                          .split('-')
                          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(' ')}
                      </h3>

                      <p className="text-gray-700 mb-4 text-sm">{metadata.audience}</p>

                      <div className="flex flex-wrap gap-2 mb-4">
                        {metadata.primaryKeywords.slice(0, 2).map((keyword, index) => (
                          <span
                            key={index}
                            className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center text-coral-600 font-semibold text-sm">
                        Learn more →
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Why Travel Time Matters */}
        <section className="mt-16 bg-white rounded-3xl shadow-xl p-8 md:p-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">
            Why Travel Time Fairness Matters
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl mb-4">⏱️</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Real Commute Times</h3>
              <p className="text-gray-700">
                We calculate actual travel times using real traffic and transit data, not just
                straight-line distance.
              </p>
            </div>

            <div className="text-center">
              <div className="text-4xl mb-4">⚖️</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Equal Travel Burden</h3>
              <p className="text-gray-700">
                Find locations where everyone's commute is balanced, showing respect for everyone's
                time.
              </p>
            </div>

            <div className="text-center">
              <div className="text-4xl mb-4">🗺️</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Visual Comparison</h3>
              <p className="text-gray-700">
                See travel time differences on an interactive map to make informed group decisions.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16 bg-gradient-to-r from-coral-500 to-coral-600 rounded-3xl p-8 md:p-12 text-center text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Plan Your Fair Meetup?</h2>
          <p className="text-xl mb-8 opacity-95">
            Start comparing travel times and finding equitable meeting locations in seconds.
          </p>
          <Link
            href="/"
            className="inline-block bg-white text-coral-600 px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-50 transition-colors shadow-lg"
          >
            Create Your Event
          </Link>
        </section>
      </main>

      {/* Footer Navigation */}
      <nav className="container mx-auto px-4 py-8 text-center space-x-6 text-sm">
        <Link href="/" className="text-gray-600 hover:text-gray-900">
          Home
        </Link>
        <Link href="/how-it-works" className="text-gray-600 hover:text-gray-900">
          How It Works
        </Link>
        <Link href="/faq" className="text-gray-600 hover:text-gray-900">
          FAQ
        </Link>
        <Link href="/contact" className="text-gray-600 hover:text-gray-900">
          Contact
        </Link>
      </nav>
    </div>
  );
}
