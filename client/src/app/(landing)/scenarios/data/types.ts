/**
 * Types for scenario-based landing pages
 */

import type { ContentMetadata } from '@/lib/seo/types/content';

/**
 * FAQ item for scenario pages
 */
export interface ScenarioFAQ {
  question: string;
  answer: string;
}

/**
 * Scenario page content structure
 */
export interface ScenarioContent {
  /** URL slug for the scenario */
  slug: string;

  /** SEO metadata */
  seo: {
    title: string;
    description: string;
    keywords: string[];
    tags: string[];
  };

  /** Hero section */
  hero: {
    h1: string;
    subheading: string;
    problemStatement: string;
  };

  /** The Problem section */
  problem: {
    heading: string;
    painPoints: string[];
    realWorldExamples: string[];
    whyMidpointFails: string;
    whyManualFails: string;
    emotionalImpact: string;
  };

  /** Solution section */
  solution: {
    heading: string;
    introduction: string;
    benefits: string[];
    beforeAfterExample: {
      before: string;
      after: string;
    };
    walkthrough: string;
    transportationNote?: string;
  };

  /** Step-by-step guide */
  stepByStep: {
    heading: string;
    steps: Array<{
      stepNumber: number;
      title: string;
      description: string;
      tip?: string;
    }>;
  };

  /** Best practices */
  bestPractices: {
    heading: string;
    tips: Array<{
      title: string;
      description: string;
    }>;
    commonMistakes: Array<{
      mistake: string;
      why: string;
      fix: string;
    }>;
  };

  /** FAQ section */
  faq: {
    heading: string;
    questions: ScenarioFAQ[];
  };

  /** CTA section */
  cta: {
    heading: string;
    description: string;
    buttonText: string;
  };

  /** Content metadata for freshness tracking */
  contentMetadata: ContentMetadata;

  /** Related scenarios for internal linking */
  relatedScenarios?: string[]; // slugs of related scenarios
}

/**
 * Scenario layer classification for SEO strategy
 */
export type ScenarioLayer = 'layer1-everyday' | 'layer2-pain-heavy' | 'layer3-edge-case';

/**
 * Scenario metadata for registry
 */
export interface ScenarioMetadata {
  slug: string;
  layer: ScenarioLayer;
  primaryKeywords: string[];
  audience: string;
  searchVolume: 'high' | 'medium' | 'low' | 'very-low';
  competition: 'high' | 'medium' | 'low' | 'very-low';
}
