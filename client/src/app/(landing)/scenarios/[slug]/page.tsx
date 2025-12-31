import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createArticleMetadata } from '@/lib/seo/metadata';
import { generateFAQSchema } from '@/lib/seo/structured-data';
import { StructuredData } from '@/components/seo/structured-data';
import { getScenario, getAllScenarioSlugs } from '../data/scenarios';
import catLogo from '@/components/cat/image.png';

interface ScenarioPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Generate metadata for scenario pages
 */
export async function generateMetadata({ params }: ScenarioPageProps): Promise<Metadata> {
  const { slug } = await params;
  const scenario = getScenario(slug);

  if (!scenario) {
    return {};
  }

  return createArticleMetadata({
    title: scenario.seo.title,
    description: scenario.seo.description,
    canonical: `/scenarios/${slug}`,
    publishedTime: scenario.contentMetadata.publishedDate,
    modifiedTime: scenario.contentMetadata.lastModified,
    authors: ['Where2Meet Team'],
    tags: scenario.seo.tags,
  });
}

/**
 * Generate static params for all scenarios
 * (Will be populated once content is added)
 */
export function generateStaticParams() {
  return getAllScenarioSlugs().map((slug) => ({
    slug,
  }));
}

export default async function ScenarioPage({ params }: ScenarioPageProps) {
  const { slug } = await params;
  const scenario = getScenario(slug);

  if (!scenario) {
    notFound();
  }

  return (
    <>
      {/* FAQ Schema */}
      {scenario.faq.questions.length > 0 && (
        <StructuredData data={generateFAQSchema(scenario.faq.questions)} />
      )}

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
            {/* Hero Section */}
            <header className="text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                {scenario.hero.h1}
              </h1>
              <p className="text-xl text-gray-600 mb-4">{scenario.hero.subheading}</p>
              <p className="text-lg text-gray-700">{scenario.hero.problemStatement}</p>
              <div className="mt-8">
                <Link
                  href="/"
                  className="inline-block bg-coral-500 text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-coral-600 transition-colors shadow-lg"
                >
                  {scenario.cta.buttonText}
                </Link>
              </div>
            </header>

            {/* The Problem Section */}
            <section>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">{scenario.problem.heading}</h2>
              <div className="prose prose-lg max-w-none text-gray-700 space-y-6">
                {/* Pain Points */}
                {scenario.problem.painPoints.length > 0 && (
                  <div>
                    <p className="font-semibold mb-3">Common challenges:</p>
                    <ul className="space-y-2">
                      {scenario.problem.painPoints.map((point, index) => (
                        <li key={index}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Real-world examples */}
                {scenario.problem.realWorldExamples.map((example, index) => (
                  <p key={index}>{example}</p>
                ))}

                {/* Why solutions fail */}
                <div className="bg-coral-50 rounded-xl p-6 border-l-4 border-coral-500">
                  <p className="font-semibold mb-2">Why the geographic midpoint fails:</p>
                  <p>{scenario.problem.whyMidpointFails}</p>
                </div>

                <div className="bg-mint-50 rounded-xl p-6 border-l-4 border-mint-500">
                  <p className="font-semibold mb-2">Why manual planning doesn't work:</p>
                  <p>{scenario.problem.whyManualFails}</p>
                </div>

                <p className="text-coral-600 font-semibold italic">
                  {scenario.problem.emotionalImpact}
                </p>
              </div>
            </section>

            {/* Solution Section */}
            <section className="bg-gradient-to-r from-mint-50 to-lavender-50 rounded-2xl p-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">{scenario.solution.heading}</h2>
              <div className="prose prose-lg max-w-none text-gray-700 space-y-6">
                <p className="text-lg">{scenario.solution.introduction}</p>

                {/* Benefits */}
                {scenario.solution.benefits.length > 0 && (
                  <div>
                    <p className="font-semibold mb-3">How Where2Meet helps:</p>
                    <ul className="space-y-2">
                      {scenario.solution.benefits.map((benefit, index) => (
                        <li key={index}>{benefit}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Before/After Example */}
                <div className="bg-white rounded-xl p-6 space-y-4">
                  <div>
                    <p className="font-semibold text-red-600 mb-2">❌ Before Where2Meet:</p>
                    <p className="text-gray-700">{scenario.solution.beforeAfterExample.before}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-green-600 mb-2">✅ After Where2Meet:</p>
                    <p className="text-gray-700">{scenario.solution.beforeAfterExample.after}</p>
                  </div>
                </div>

                <p>{scenario.solution.walkthrough}</p>

                {scenario.solution.transportationNote && (
                  <p className="text-sm italic">{scenario.solution.transportationNote}</p>
                )}
              </div>
            </section>

            {/* Step-by-Step Guide */}
            <section>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                {scenario.stepByStep.heading}
              </h2>
              <div className="space-y-6">
                {scenario.stepByStep.steps.map((step) => (
                  <div key={step.stepNumber} className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-coral-500 text-white rounded-full flex items-center justify-center font-bold text-xl">
                      {step.stepNumber}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">{step.title}</h3>
                      <p className="text-gray-700">{step.description}</p>
                      {step.tip && (
                        <p className="text-sm text-coral-600 mt-2 italic">💡 Tip: {step.tip}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Best Practices */}
            <section className="bg-lavender-50 rounded-2xl p-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                {scenario.bestPractices.heading}
              </h2>

              {/* Tips */}
              {scenario.bestPractices.tips.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Pro Tips:</h3>
                  <div className="space-y-4">
                    {scenario.bestPractices.tips.map((tip, index) => (
                      <div key={index}>
                        <p className="font-semibold text-gray-900">{tip.title}</p>
                        <p className="text-gray-700">{tip.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Common Mistakes */}
              {scenario.bestPractices.commonMistakes.length > 0 && (
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Common Mistakes:</h3>
                  <div className="space-y-4">
                    {scenario.bestPractices.commonMistakes.map((mistake, index) => (
                      <div key={index} className="bg-white rounded-xl p-4">
                        <p className="font-semibold text-red-600 mb-1">❌ {mistake.mistake}</p>
                        <p className="text-gray-700 text-sm mb-2">Why: {mistake.why}</p>
                        <p className="text-green-600 text-sm">✓ Fix: {mistake.fix}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* FAQ Section */}
            {scenario.faq.questions.length > 0 && (
              <section>
                <h2 className="text-3xl font-bold text-gray-900 mb-6">{scenario.faq.heading}</h2>
                <div className="space-y-6">
                  {scenario.faq.questions.map((faq, index) => (
                    <div key={index}>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">{faq.question}</h3>
                      <p className="text-gray-700">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* CTA Section */}
            <section className="bg-gradient-to-r from-coral-500 to-coral-600 rounded-2xl p-8 md:p-12 text-center text-white">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">{scenario.cta.heading}</h2>
              <p className="text-xl mb-8 opacity-95">{scenario.cta.description}</p>
              <Link
                href="/"
                className="inline-block bg-white text-coral-600 px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-50 transition-colors shadow-lg"
              >
                {scenario.cta.buttonText}
              </Link>
            </section>

            {/* Related Scenarios */}
            {scenario.relatedScenarios && scenario.relatedScenarios.length > 0 && (
              <section className="border-t-2 border-gray-200 pt-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Related Meeting Scenarios</h2>
                <div className="flex flex-wrap gap-4">
                  {scenario.relatedScenarios.map((relatedSlug) => (
                    <Link
                      key={relatedSlug}
                      href={`/scenarios/${relatedSlug}`}
                      className="text-coral-600 hover:text-coral-700 font-semibold hover:underline"
                    >
                      {relatedSlug
                        .split('-')
                        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ')}{' '}
                      →
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Last Updated */}
            <footer className="text-sm text-gray-500 border-t border-gray-200 pt-6">
              Last updated:{' '}
              {new Date(scenario.contentMetadata.lastModified).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </footer>
          </article>

          {/* Navigation */}
          <nav className="mt-8 text-center space-x-6 text-sm">
            <Link href="/" className="text-gray-600 hover:text-gray-900">
              Home
            </Link>
            <Link href="/scenarios" className="text-gray-600 hover:text-gray-900">
              All Scenarios
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
    </>
  );
}
