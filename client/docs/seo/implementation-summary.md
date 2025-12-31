# SEO Implementation Summary - Where2Meet

**Last Updated:** 2025-01-31
**Status:** Phase 1 Complete ✅
**Domain:** https://where2meet.org

---

## Executive Summary

This document summarizes all SEO optimizations implemented for Where2Meet following the 5-Level SEO Implementation Plan. The focus is on **programmatic scenario pages**, **content freshness**, **user behavior tracking**, and **brand differentiation** (fairness + travel time comparison).

**Key Results:**

- ✅ 8 high-quality scenario pages (1000-1500 words each)
- ✅ Scenarios hub page with navigation
- ✅ Enhanced GA4 tracking (scroll depth, engagement, CTAs)
- ✅ Content metadata system for freshness tracking
- ✅ Consistent "fairness + travel time" brand messaging
- ✅ Updated sitemap with 13 total URLs (4 core + 1 hub + 8 scenarios)

---

## 1. Search Intent Map

**Location:** `/docs/seo/search-intent-map.md`

**Purpose:** Categorize 50+ search queries by intent type to determine which pages to build.

**Key Intent Categories:**

1. **Problem-Aware (Informational):**
   - "how to find fair meeting point"
   - "where to meet in the middle calculator"
   - "central location for multiple addresses"

2. **Solution-Aware (Commercial Investigation):**
   - "best meeting point calculator"
   - "fair meeting planner vs where2meet.net"
   - "travel time comparison tool"

3. **Use Case Queries (Transactional - HIGH VALUE):**
   - "fair meeting point for remote teams"
   - "meeting spot for friends"
   - "central location for client meetings"

**Outcome:** Prioritized 8 initial scenario pages based on:

- Distinct search intent (no keyword overlap)
- Different audiences (remote teams ≠ friends ≠ families)
- Non-competing keywords (avoid cannibalization)

---

## 2. Programmatic SEO - Scenario Pages

**Strategy:** Create 8-10 high-quality, deeply unique scenario pages (1000-1500 words each) to avoid thin content and keyword cannibalization.

### Phase 1: Initial 8 Scenario Pages (LIVE)

**Layer 1: High-Intent, Everyday Use (5 pages)**

1. `/scenarios/friends-group-dinner-spot` - "fair restaurant for friends", "central dinner location group"
2. `/scenarios/date-night-equal-distance` - "fair date location", "equal distance date spot"
3. `/scenarios/coworkers-lunch-spot` - "team lunch location", "coworkers lunch spot fair"
4. `/scenarios/group-weekend-hangout` - "weekend meetup location", "where to hang out with friends group"
5. `/scenarios/family-reunion-location-finder` - "family reunion location planner", "fair venue extended family"

**Layer 2: Pain-Heavy Coordination (3 pages)** 6. `/scenarios/remote-team-offsite-planning` - "remote team offsite location", "distributed team retreat planning" 7. `/scenarios/cross-city-client-meetings` - "client meeting between cities", "business meeting location two cities" 8. `/scenarios/long-distance-friends-reunion` - "meeting friends from different cities", "long distance friends meetup"

### Content Structure (per page)

Each scenario page contains **1000-1500 unique words** with:

1. **Hero Section** (150-200 words)
   - H1: "Fair [Use Case] – Travel Time Comparison Planner"
   - Scenario-specific problem statement with real example
   - CTA: "Start Planning Fair Meetup"

2. **The Problem - Deep Dive** (300-400 words)
   - Multiple specific pain points
   - 2-3 real-world examples of unfairness
   - Why geographic midpoint fails (with example)
   - Why manual planning fails (with example)
   - Emotional impact

3. **How Where2Meet Solves It** (300-400 words)
   - Travel time comparison explanation
   - Fairness calculation for this use case
   - Visual map advantages
   - Transportation mode relevance
   - Before/After comparison

4. **Step-by-Step Guide** (200-250 words)
   - Create event for [scenario] with tips
   - Add participants
   - View travel times
   - Vote on fair venue
   - Finalize and share

5. **Best Practices & Pro Tips** (200-250 words)
   - 5-7 scenario-specific tips
   - Common mistakes to avoid (with why)
   - Advanced features for this use case

6. **FAQ Section** (5-6 Q&As)
   - Scenario-specific questions
   - FAQ schema markup
   - Address objections and edge cases

### File Structure

```
src/app/(landing)/scenarios/
  ├── [slug]/
  │   └── page.tsx                  # Dynamic route for scenario pages
  ├── layout.tsx                    # Shared layout
  ├── page.tsx                      # Scenarios hub page
  └── data/
      ├── scenarios.ts              # Content data (1000-1500 words per scenario)
      └── types.ts                  # TypeScript types
```

### Metadata Configuration

Using `createArticleMetadata()` from `/src/lib/seo/metadata.ts`:

```typescript
export const metadata = createArticleMetadata({
  title: 'Fair Meeting Point for Remote Team Offsites',
  description:
    "Find equitable offsite locations for remote teams. Compare travel times, balance commutes, and discover venues that respect everyone's time.",
  canonical: '/scenarios/remote-team-offsite-planning',
  publishedTime: '2025-01-31T00:00:00Z',
  modifiedTime: '2025-01-31T00:00:00Z',
  tags: ['remote teams', 'offsites', 'fair meeting'],
});
```

### Internal Linking Strategy

1. **Scenarios Hub Page:** `/scenarios` - lists all 8 scenarios grouped by category
2. **Homepage Footer:** Added "Scenarios" link to main navigation
3. **Cross-linking:** Each scenario links to 2-3 related scenarios
4. **How It Works:** Links to 2-3 scenario examples
5. **FAQ:** Links to relevant scenarios where appropriate

---

## 3. Sitemap Integration

**Location:** `/src/app/sitemap.ts`

**Total URLs:** 13 (4 core pages + 1 hub + 8 scenarios)

```typescript
// Core Pages (4)
- / (priority: 1.0, changeFrequency: weekly)
- /how-it-works (priority: 0.8, changeFrequency: monthly)
- /faq (priority: 0.8, changeFrequency: monthly)
- /contact (priority: 0.5, changeFrequency: yearly)

// Scenarios Hub (1)
- /scenarios (priority: 0.8, changeFrequency: monthly)

// Scenario Pages (8)
- /scenarios/friends-group-dinner-spot (priority: 0.7, changeFrequency: monthly)
- /scenarios/date-night-equal-distance (priority: 0.7, changeFrequency: monthly)
- /scenarios/coworkers-lunch-spot (priority: 0.7, changeFrequency: monthly)
- /scenarios/group-weekend-hangout (priority: 0.7, changeFrequency: monthly)
- /scenarios/family-reunion-location-finder (priority: 0.7, changeFrequency: monthly)
- /scenarios/remote-team-offsite-planning (priority: 0.7, changeFrequency: monthly)
- /scenarios/cross-city-client-meetings (priority: 0.7, changeFrequency: monthly)
- /scenarios/long-distance-friends-reunion (priority: 0.7, changeFrequency: monthly)
```

**Important Notes:**

- Dynamic meeting pages (`/meet/[id]`) are intentionally excluded (noindex, temporary, user-generated)
- All scenario pages have `robots: { index: true, follow: true }`
- Domain is correctly set to `https://where2meet.org` (not .com)

---

## 4. User Behavior Tracking (GA4)

**Purpose:** Capture engagement signals that improve SEO rankings.

### New Tracking Events

**Location:** `/src/lib/analytics/tracking/`

1. **Scroll Depth** (`scroll_depth`)
   - Track at: 25%, 50%, 75%, 90%, 100%
   - Implementation: IntersectionObserver API
   - Track once per depth per page load
   - File: `scroll-tracking.ts`

2. **Engagement Time** (`engagement_time`)
   - Track at: 30s, 60s, 120s, 300s of active time
   - Implementation: Page Visibility API (pause when tab inactive)
   - Send final time on page unload
   - File: `engagement-tracking.ts`

3. **CTA Clicks** (`cta_click`)
   - Parameters: `cta_text`, `cta_location` (hero/mid-page/footer), `cta_type`
   - Track all "Create Event", "Start Planning" buttons
   - File: `cta-tracking.ts`

4. **Exit Intent** (`exit_intent`)
   - Detect mouse leaving viewport (desktop)
   - Track bounce candidates (< 10s on page)

5. **Enhanced Map Interactions** (`map_interaction`)
   - Track: zoom, pan, marker_click, route_view
   - Track filter usage: transportation, price, rating

### React Hooks

**Location:** `/src/lib/analytics/hooks/`

- `useScrollTracking.ts` - Scroll depth tracking hook
- `useEngagementTracking.ts` - Engagement time tracking hook
- `useCTATracking.ts` - CTA click tracking hook

**Integration Status:**

- ✅ Hooks created
- ⏳ Integration pending (add to landing and scenario pages)

**GA4 Property ID:** G-FXFWSY7CFL

---

## 5. Content Freshness System

**Purpose:** Track content age and schedule regular updates to maintain SEO freshness.

### Content Metadata Type

**Location:** `/src/lib/seo/types/content.ts`

```typescript
export interface ContentMetadata {
  publishedDate: string;
  lastModified: string;
  lastReviewed: string;
  nextReviewDate: string;
  contentType: 'article' | 'landing' | 'feature' | 'faq' | 'scenario';
  updateFrequency: 'monthly' | 'quarterly' | 'yearly';
  status: 'current' | 'needs_review' | 'stale';
}
```

### Update Schedule by Page Type

**Location:** `/src/lib/seo/content-registry.ts`

```typescript
export const PAGE_UPDATE_SCHEDULE = {
  landing: 'Review monthly, update quarterly or when features change',
  feature: 'Review quarterly, update when product changes',
  faq: 'Review monthly, add new questions based on user feedback',
  scenario: 'Review quarterly, refresh examples seasonally',
  article: 'Review quarterly, update statistics and examples',
};
```

### Content Registry

**Location:** `/src/lib/seo/content-registry.ts`

```typescript
export const CONTENT_REGISTRY: Record<string, ContentMetadata> = {
  '/': createContentMetadata('landing', 'monthly'),
  '/how-it-works': createContentMetadata('feature', 'quarterly'),
  '/faq': createContentMetadata('faq', 'monthly'),
  '/contact': createContentMetadata('landing', 'yearly'),
  // Scenario pages added via createContentMetadata('scenario', 'quarterly')
};
```

### Helper Functions

```typescript
// Check if content needs review
export function needsReview(metadata: ContentMetadata): boolean;

// Get all pages needing review
export function getPagesNeedingReview(): Array<{ path: string; metadata: ContentMetadata }>;

// Check if content is stale (> 6 months)
export function isStale(metadata: ContentMetadata): boolean;

// Get all stale pages
export function getStalePages(): Array<{ path: string; metadata: ContentMetadata }>;
```

### Content Audit Script

**Location:** `/scripts/audit-content.ts`

**Purpose:** Automated script to:

1. Scan all pages for content metadata
2. Flag pages with `nextReviewDate < today`
3. Flag pages `lastModified > 6 months`
4. Generate report at `/docs/content/stale-content-report.md`

**Usage:**

```bash
npm run audit:content
```

### Display Last Updated

All scenario pages display last updated date in footer:

```tsx
<footer className="text-sm text-gray-500">
  Last updated: {new Date(contentMetadata.lastModified).toLocaleDateString()}
</footer>
```

---

## 6. Brand Semantic Defense

**Purpose:** Ensure consistent "fairness + travel time" messaging across all pages to strengthen brand differentiation vs competitors (where2meet.net).

### Brand Messaging Pillars

**Primary:**

1. **Fairness** - Equal travel burden, not just geographic midpoint
2. **Travel Time Comparison** - Real commute times, not distance
3. **Visual Analysis** - Interactive maps showing tradeoffs
4. **Group Decision Making** - Transparent, collaborative voting
5. **No Sign-Up Required** - Start planning immediately, no account needed

**Secondary:**

- Time respect: "Everyone's time matters"
- Equity: "No one should bear unfair burden"
- Transparency: "See the tradeoffs, decide together"
- Instant access: "No account required, start planning now"

### Preferred Language

**Always use:**

- "Real travel times" (not estimates)
- "Equal commutes" (not equal distance)
- "Fair meeting spot with equal travel times"
- "Time-balanced location"
- "Balanced travel burden"
- "No sign-up required" or "Start planning instantly"
- "Create your event in seconds"

**Avoid:**

- ❌ "Find a meeting spot" (generic)
- ❌ "Central location" (without "fair")
- ❌ "Midpoint calculator"
- ❌ "Sign up to get started" (no registration needed!)

### Page-by-Page Updates

**Homepage** (`/src/app/(landing)/page.tsx`)

- ✅ H1: "Find **Fair Meeting Spots** with Equal Travel Times"
- ✅ Hero: "Stop making one person travel twice as far"
- ✅ Feature cards: Emphasize "Equal Travel Times" and "Fair for Everyone"
- ✅ Differentiation callout: "Unlike other planners, Where2Meet optimizes for travel time fairness, not just distance"
- ✅ Footer: Added "Scenarios" link
- ⏳ **Recommended:** Add "No sign-up required" benefit prominently in hero or as feature card
  - Example: "Start planning in seconds—no account required"

**How It Works** (`/src/app/(landing)/how-it-works/page.tsx`)

- ✅ Added comparison table: Where2Meet vs Geographic Midpoint vs Manual Planning
- ✅ Strengthened CTA: "See Fair Meeting Planning in Action"
- ✅ Emphasized travel time fairness throughout

**FAQ** (`/src/app/(landing)/faq/page.tsx`)

- ⏳ Add FAQ: "How is Where2Meet different from where2meet.net?"
- ⏳ Add FAQ: "Does Where2Meet just find the midpoint?"
- ⏳ Add FAQ: "Why is travel time more fair than distance?"
- ⏳ Add FAQ: "Do I need to create an account?" → Answer: "No! Start planning immediately without signing up."

**Scenario Pages** (All 8)

- ✅ Every H1 includes "fair" or "equal travel time"
- ✅ Meta descriptions mention differentiation
- ✅ First paragraph explains fairness problem
- ✅ Problem section emphasizes unfairness with specific example
- ✅ Solution section highlights travel time comparison
- ✅ "Why Travel Time Matters for [Scenario]" callout in problem section

---

## 7. Metadata Configuration

**Location:** `/src/lib/seo/metadata.ts`

### Site Configuration

```typescript
export const SITE_CONFIG = {
  name: 'Where2Meet',
  url: 'https://where2meet.org', // ✅ Correct domain
  author: 'Where2Meet Team',
  locale: 'en_US',
  themeColor: '#3b82f6',
  defaultTitle: 'Where2Meet – Fair Meeting Planner with Travel Time Comparison',
  description: 'Find fair meeting spots with equal travel time for everyone...',
};
```

### Strategic Keywords (Organized by Category)

```typescript
keywords: {
  // Core generic keywords
  core: [
    'meeting spot finder',
    'central meeting point',
    'group meeting planner',
    'meetup location',
  ],

  // Differentiation keywords - what makes Where2Meet unique
  differentiation: [
    'fair meeting planner',
    'travel time comparison',
    'equal commute meeting',
    'fair travel distance',
    'equidistant meeting point',
    'commute fairness',
  ],

  // AI/Smart features
  ai: ['AI meeting planner', 'smart meeting location', 'intelligent venue finder'],

  // Feature-specific
  features: [
    'visual map meeting planner',
    'multi-location midpoint',
    'travel time visualization',
    'meeting cost calculator',
  ],
}
```

### Metadata Presets

1. **createMetadata()** - General page metadata
2. **createMeetingPageMetadata()** - Meeting pages (noindex)
3. **createArticleMetadata()** - Blog/article pages (used for scenarios)
4. **createFeaturePageMetadata()** - Feature/landing pages

### Keywords Focus Strategy

- **Homepage:** `keywordsFocus: 'differentiation'` - Emphasize fair travel time
- **How It Works:** `keywordsFocus: 'features'` - Highlight capabilities
- **Scenarios:** `keywordsFocus: 'features'` - Feature-specific keywords
- **Meeting Pages:** `robots: { index: false, follow: true }` - No indexing

---

## 8. Structured Data (Schema.org)

**Location:** `/src/lib/seo/structured-data.ts`

### Implemented Schemas

1. **Organization Schema** (All pages)

   ```json
   {
     "@type": "Organization",
     "name": "Where2Meet",
     "url": "https://where2meet.org",
     "description": "Fair meeting planner with travel time comparison"
   }
   ```

2. **FAQ Schema** (Scenario pages)
   - Generated dynamically from scenario FAQ content
   - Located in `/src/components/seo/structured-data.tsx`
   - Implemented on all 8 scenario pages

3. **Article Schema** (Future)
   - Planned for blog posts
   - Not yet implemented

---

## 9. Technical Optimizations

### Next.js 15+ Async Params Fix

**Issue:** Next.js 15+ changed `params` to be asynchronous (Promise).

**Fix Applied:**

- **File:** `/src/app/(landing)/scenarios/[slug]/page.tsx`
- **Changes:**
  - Updated `ScenarioPageProps` interface: `params: Promise<{ slug: string }>`
  - Updated `generateMetadata`: `const { slug } = await params;`
  - Updated `ScenarioPage` component: `const { slug } = await params;` + made function async

**Status:** ✅ Fixed - All scenario pages accessible

### Static Site Generation

**File:** `/src/app/(landing)/scenarios/[slug]/page.tsx`

```typescript
export function generateStaticParams() {
  return getAllScenarioSlugs().map((slug) => ({
    slug,
  }));
}
```

- Generates static pages for all 8 scenarios at build time
- Improves performance and SEO (no server-side rendering delay)

---

## 10. Performance Metrics & Goals

### Target Metrics (Month 1-6)

**Organic Traffic:**

- Month 1: +20% organic sessions
- Month 3: +50% organic sessions
- Month 6: +100% organic sessions

**Rankings:**

- Top 10 for "fair meeting planner"
- Top 20 for "travel time comparison meeting"
- Top 30 for 20+ scenario-specific long-tail keywords

**Indexed Pages:**

- Month 1: 13 pages indexed (4 core + 1 hub + 8 scenarios)
- Month 3-6: Gradual growth to 20-25 pages (data-driven expansion)

**Engagement (GA4):**

- 40% of visitors scroll 50%+ on scenario pages
- 2+ minutes average on scenario pages
- 5-8% CTR on hero CTAs
- <60% bounce rate on scenario pages

**Content Freshness:**

- 100% of pages reviewed within schedule
- 0 pages >6 months without review

---

## 11. Next Steps & Monitoring

### Immediate Next Steps (Week 1-2)

1. **Integrate GA4 Tracking Hooks**
   - Add `useScrollTracking()` to all landing and scenario pages
   - Add `useEngagementTracking()` to track active time
   - Add `useCTATracking()` to all CTA buttons
   - Test all events in GA4

2. **Complete Brand Messaging Updates**
   - Add competitive differentiation FAQs to `/faq`
   - Add "Do I need to create an account?" FAQ → "No! Start planning immediately without signing up"
   - Strengthen homepage value proposition with "No sign-up required" benefit
   - Add "Start planning instantly—no account needed" to hero or feature cards
   - Add comparison callouts to How It Works

3. **Submit to Search Engines**
   - Submit sitemap to Google Search Console: `https://where2meet.org/sitemap.xml`
   - Submit to Bing Webmaster Tools
   - Request indexing for all 13 URLs

4. **Set Up Monitoring**
   - Google Search Console: Track impressions, clicks, rankings
   - GA4: Create custom exploration for scenario page performance
   - Weekly review of stale content (run `npm run audit:content`)

### Phase 2 Planning (Month 2-3)

**Wait for Initial Data Before Expanding:**

1. Monitor Google Search Console queries for 2-3 months
2. Identify which scenario pages are gaining traction
3. Identify gaps in coverage (what users are searching for)
4. Select 2-3 new scenarios based on actual search data
5. Generate new 1000-1500 word pages
6. Add to sitemap gradually (1 page every 2 weeks)
7. Monitor performance before adding more

**Expansion Guidelines:**

- Maximum 3-5 new pages every 2-3 months
- Always check for keyword cannibalization first
- Quality over quantity
- Build trust gradually

### Monthly Content Reviews

**Schedule:**

- **Homepage:** Review monthly, update quarterly
- **How It Works:** Review quarterly
- **FAQ:** Review monthly, add new questions
- **Scenarios:** Review quarterly, refresh examples
- **Contact:** Review yearly

**Process:**

1. Run `npm run audit:content`
2. Review flagged pages
3. Update stale examples, statistics, screenshots
4. Update `lastModified` and `lastReviewed` dates

---

## 12. Files Modified/Created

### New Files Created

**SEO & Content:**

- `/docs/seo/search-intent-map.md`
- `/docs/seo/implementation-summary.md` (this file)
- `/src/lib/seo/types/content.ts`
- `/src/lib/seo/content-registry.ts`
- `/scripts/audit-content.ts`

**Scenario Pages:**

- `/src/app/(landing)/scenarios/[slug]/page.tsx`
- `/src/app/(landing)/scenarios/layout.tsx`
- `/src/app/(landing)/scenarios/page.tsx`
- `/src/app/(landing)/scenarios/data/scenarios.ts`
- `/src/app/(landing)/scenarios/data/types.ts`

**Analytics:**

- `/src/lib/analytics/tracking/scroll-tracking.ts`
- `/src/lib/analytics/tracking/engagement-tracking.ts`
- `/src/lib/analytics/tracking/cta-tracking.ts`
- `/src/lib/analytics/hooks/useScrollTracking.ts`
- `/src/lib/analytics/hooks/useEngagementTracking.ts`
- `/src/lib/analytics/hooks/useCTATracking.ts`

### Existing Files Modified

**SEO:**

- `/src/app/sitemap.ts` - Added 9 new URLs (scenarios hub + 8 scenarios)
- `/src/lib/seo/metadata.ts` - Verified domain configuration

**Analytics:**

- `/src/lib/analytics/events.ts` - Extended with new events

**Pages (Brand Updates):**

- `/src/app/(landing)/page.tsx` - Strengthened brand messaging + added scenarios link
- `/src/app/(landing)/how-it-works/page.tsx` - Added comparison table
- `/src/app/(landing)/faq/page.tsx` - (pending differentiation FAQs)

---

## 13. Risks & Mitigation

**Risk:** Google views scenario pages as thin/duplicate content
**Mitigation:**

- ✅ Each page has 1000-1500 unique words (deep value)
- ✅ Completely different examples and use cases
- ✅ Unique FAQs per scenario
- ✅ Proper canonical URLs
- ✅ Gradual rollout (8 pages initially, not 30)
- ✅ Distinct keywords per page (no cannibalization)
- ⏳ Wait for performance data before expanding

**Risk:** Tracking overhead slows pages
**Mitigation:**

- Debounced events
- IntersectionObserver (performant)
- Next.js afterInteractive loading

**Risk:** Content becomes stale
**Mitigation:**

- ✅ Automated audit script
- ✅ Review schedules
- ✅ Visible "Last Updated" dates

**Risk:** Brand message dilution
**Mitigation:**

- ✅ Brand checklist required
- ✅ Voice guidelines
- ⏳ Regular audits

---

## 14. Dependencies & Tools

- **Next.js 15+** ✅ (installed)
- **TypeScript** ✅ (installed)
- **schema-dts** ✅ (installed)
- **GA4 setup** ✅ (configured with ID: G-FXFWSY7CFL)
- **Google Search Console** ⏳ (needs sitemap submission)
- **No new packages required**

---

## 15. Success Metrics Dashboard

### Google Search Console (Weekly Review)

**Track:**

- Total impressions (target: +20% month-over-month)
- Total clicks (target: +15% month-over-month)
- Average CTR (target: >3%)
- Average position (target: <20 for key terms)

**Key Queries to Monitor:**

- "fair meeting planner"
- "travel time comparison meeting"
- "where to meet friends fair"
- Scenario-specific long-tail keywords

### GA4 Custom Exploration

**Create custom report for:**

- Landing page performance (scenarios vs core pages)
- Scroll depth by page
- Engagement time by page
- CTA click-through rates
- Traffic sources (organic search breakdown)

### Content Audit Report

**Monthly:**

- Pages needing review
- Stale content (>6 months)
- Update completion rate

---

## 16. Contact & Maintenance

**Primary Maintainer:** Development Team
**Review Schedule:** Monthly SEO audit meeting
**Escalation:** Flag stale content or ranking drops immediately

**Tools Access:**

- Google Search Console: [Connect domain]
- GA4: Property ID G-FXFWSY7CFL
- GitHub: [Repository link]

---

## Conclusion

Phase 1 of the SEO implementation is **complete**. The foundation is in place with:

- 8 high-quality scenario pages targeting distinct keywords
- Content freshness system for ongoing maintenance
- Enhanced user behavior tracking (pending integration)
- Consistent brand messaging emphasizing fairness + travel time

**Next critical step:** Submit sitemap to Google Search Console and monitor performance for 2-3 months before expanding to additional scenario pages.

---

**Document Version:** 1.0
**Created:** 2025-01-31
**Last Review:** 2025-01-31
**Next Review:** 2025-02-28
