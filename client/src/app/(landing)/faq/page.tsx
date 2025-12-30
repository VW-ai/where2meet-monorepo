import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { createMetadata } from '@/lib/seo/metadata';
import { generateFAQSchema, type FAQItem } from '@/lib/seo/structured-data';
import { StructuredData } from '@/components/seo/structured-data';
import catLogo from '@/components/cat/image.png';

export const metadata: Metadata = createMetadata({
  title: 'FAQ – Fair Meeting Locations & Travel Time Planning',
  description:
    'Answers to common questions about Where2Meet, including how fair meeting locations are calculated, travel time comparison, privacy, and group planning.',
  canonical: '/faq',
  robots: { index: true, follow: true },
  keywordsFocus: 'differentiation',
});

// FAQ Data - organized by category
const faqData: Array<{ category: string; questions: FAQItem[] }> = [
  {
    category: 'Differentiation',
    questions: [
      {
        question: 'What makes Where2Meet different from other meeting planners?',
        answer:
          'Where2Meet focuses on fairness, not just finding a midpoint. We calculate actual travel times for each participant and optimize for balanced commutes—so no one person bears an unfair travel burden. Other tools show geographic distance; we show real-world fairness.',
      },
      {
        question: 'Does Where2Meet calculate fairness or just distance?',
        answer:
          "Where2Meet optimizes for travel time fairness, not just distance. We use real routing data to compare how long it takes each person to reach a location, then find spots where everyone's commute is balanced. Distance doesn't account for traffic, transit routes, or road networks—time does.",
      },
      {
        question: 'Why is travel time better than distance when choosing a meeting point?',
        answer:
          'Travel time reflects the actual burden of getting somewhere. A location might be 5 miles from two people, but one person could reach it in 10 minutes by highway while the other needs 30 minutes through side streets. Travel time accounts for transportation mode, traffic, route complexity, and real-world commute experience.',
      },
      {
        question: 'How does Where2Meet ensure everyone travels fairly?',
        answer:
          "Our algorithm finds meeting locations where the difference in travel times between participants is minimized. We prioritize locations where everyone's commute is roughly equal, rather than optimizing for the shortest total distance. You can see each person's travel time on the map and vote on the fairest option together.",
      },
    ],
  },
  {
    category: 'Product Mechanics',
    questions: [
      {
        question: 'How does Where2Meet calculate the meeting location?',
        answer:
          "Where2Meet uses real routing APIs to calculate travel times from each participant's location to potential meeting spots. Our algorithm then finds locations that minimize total travel time while balancing commutes across all participants. We consider multiple transportation modes (driving, public transit, walking) and show you the results on an interactive map.",
      },
      {
        question: 'Does Where2Meet use real travel times?',
        answer:
          "Yes. Where2Meet queries real routing data to get accurate travel times based on current road networks, transit schedules, and traffic patterns. We don't estimate based on straight-line distance—we use the same data that powers navigation apps.",
      },
      {
        question: 'Which transportation modes are supported?',
        answer:
          'Where2Meet supports driving, public transit, and walking. You can choose the most relevant mode for your group when planning. This ensures the travel time calculations reflect how people will actually get to the meeting spot.',
      },
      {
        question: 'Can I see travel times for each participant?',
        answer:
          "Yes. The interactive map shows each participant's location, their route to potential venues, and their estimated travel time. This transparency helps your group make informed decisions about which location is truly fairest.",
      },
    ],
  },
  {
    category: 'Use Cases',
    questions: [
      {
        question: 'Is Where2Meet good for group meetups with friends?',
        answer:
          'Absolutely. Where2Meet is perfect for finding restaurants, cafés, parks, or entertainment venues that are fair for everyone in your friend group. No more "let\'s just meet at my place"—find a spot that respects everyone\'s time.',
      },
      {
        question: 'Can remote teams use Where2Meet?',
        answer:
          "Yes. Remote teams use Where2Meet to plan offsites, workshops, and team gatherings where members are spread across different cities or neighborhoods. Find a central location that's fair for everyone, whether it's a coworking space, hotel, or event venue.",
      },
      {
        question: 'Is Where2Meet useful for people in different cities?',
        answer:
          "Yes. Where2Meet works great for cross-city meetups. If your group spans multiple cities, we'll find a location—often in a central city or along a common route—that balances travel times for everyone.",
      },
      {
        question: 'Can I plan a meeting without knowing exact addresses?',
        answer:
          'You can use general locations (like neighborhoods or landmarks) as starting points, but exact addresses provide the most accurate travel time calculations. We recommend having participants enter their actual starting locations for the best results.',
      },
    ],
  },
  {
    category: 'Practical Questions',
    questions: [
      {
        question: 'Is Where2Meet free to use?',
        answer:
          'Yes, Where2Meet is free to use. You can create meetings, add unlimited participants, view the map, and vote on venues without any cost.',
      },
      {
        question: 'Do participants need an account?',
        answer:
          'No. Participants can join a meeting by simply clicking a shared link—no account required. They can add their location, view the map, and vote on venues without signing up. Organizers can optionally create an account to manage multiple events.',
      },
      {
        question: 'Can I share a meeting link with others?',
        answer:
          'Yes. Every meeting has a unique shareable link. Send it to participants via text, email, or messaging apps. Anyone with the link can join, add their location, and participate in venue voting.',
      },
      {
        question: 'Are my locations private?',
        answer:
          'Locations are only visible to people with the meeting link. Your location data is not shared publicly or sold to third parties. Only participants in your specific meeting can see where everyone is starting from.',
      },
    ],
  },
];

// Flatten all questions for FAQ schema
const allFAQs: FAQItem[] = faqData.flatMap((category) => category.questions);

export default function FAQPage() {
  return (
    <>
      {/* FAQ Schema */}
      <StructuredData data={generateFAQSchema(allFAQs)} />

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
          <article className="bg-white rounded-3xl shadow-xl p-8 md:p-12">
            {/* Hero */}
            <header className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Where2Meet FAQ – Fair Meeting Locations Explained
              </h1>
              <p className="text-xl text-gray-600">
                Everything you need to know about finding fair meeting spots with travel time
                comparison
              </p>
            </header>

            {/* FAQ Categories */}
            <div className="space-y-12">
              {faqData.map((category, categoryIndex) => (
                <section key={categoryIndex}>
                  <h2 className="text-2xl font-bold text-coral-600 mb-6 pb-2 border-b-2 border-coral-200">
                    {category.category}
                  </h2>

                  <div className="space-y-8">
                    {category.questions.map((faq, faqIndex) => (
                      <div key={faqIndex}>
                        <h3 className="text-xl font-semibold text-gray-900 mb-3">{faq.question}</h3>
                        <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {/* CTA Section */}
            <section className="mt-12 pt-12 border-t-2 border-gray-200 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Still Have Questions?</h2>
              <p className="text-gray-600 mb-6">
                Check out{' '}
                <Link
                  href="/how-it-works"
                  className="text-coral-600 hover:text-coral-700 font-semibold"
                >
                  how Where2Meet works
                </Link>{' '}
                or{' '}
                <Link href="/contact" className="text-coral-600 hover:text-coral-700 font-semibold">
                  contact us
                </Link>
                .
              </p>
              <Link
                href="/"
                className="inline-block bg-coral-500 text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-coral-600 transition-colors shadow-lg"
              >
                Start Planning a Meeting
              </Link>
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
            <Link href="/contact" className="text-gray-600 hover:text-gray-900">
              Contact
            </Link>
          </nav>
        </main>
      </div>
    </>
  );
}
