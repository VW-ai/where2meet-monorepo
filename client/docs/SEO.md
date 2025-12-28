# SEO Implementation Guide - Where2Meet

## Overview

Where2Meet has been optimized for search engines with comprehensive SEO implementation targeting meeting planner keywords. This document describes the SEO architecture, configuration, and maintenance guidelines.

---

## Table of Contents

1. [SEO Strategy](#seo-strategy)
2. [Configuration](#configuration)
3. [Implementation Details](#implementation-details)
4. [Google Analytics Setup](#google-analytics-setup)
5. [Asset Requirements](#asset-requirements)
6. [Testing & Verification](#testing--verification)
7. [Maintenance](#maintenance)
8. [Expected Outcomes](#expected-outcomes)

---

## SEO Strategy

### Target Keywords

**Primary Keywords (Landing Page):**

- "meeting spot finder" (primary focus)
- "group meeting planner"
- "find meeting location"
- "central meeting point calculator"
- "where to meet friends"

**Supporting Keywords:**

- "compare travel times"
- "fair meeting location"
- "visual meeting planning"
- "optimal meeting venue finder"

### Page Indexing Strategy

| Page Type                  | Index Strategy           | Rationale                                     |
| -------------------------- | ------------------------ | --------------------------------------------- |
| Landing Page (/)           | ✅ Index + Follow        | Main SEO target for organic traffic           |
| Meeting Pages (/meet/[id]) | ❌ NoIndex + ✅ Follow   | Prevents spam, enables social sharing OG tags |
| Dashboard (/dashboard)     | ❌ NoIndex + ❌ NoFollow | Private user data, security                   |
| Auth Pages (/auth/\*)      | ❌ NoIndex + ❌ NoFollow | Private pages, no SEO value                   |

#### Meeting Page Strategy (Critical)

Meeting pages use a special **noindex/follow** strategy:

```typescript
robots: {
  index: false, // Don't rank these pages
  follow: true, // Allow crawling for Open Graph
}
```

**Why?**

- **noindex:** Prevents low-quality spam event pages from diluting site authority
- **follow:** Allows Google to crawl and cache Open Graph tags for perfect social sharing
- **Result:** Shared meeting links look beautiful on social media while keeping private/temporary events out of search results

---

## Configuration

### Site Configuration

Location: `/src/lib/seo/metadata.ts`

```typescript
export const SITE_CONFIG = {
  name: 'Where2Meet',
  url: process.env.NEXT_PUBLIC_APP_URL || 'https://where2meet.com',
  description:
    'Find the perfect meeting spot for everyone. Compare travel times, visualize locations on a map, and discover ideal venues for your group meetings.',
  keywords: [
    'meeting spot finder',
    'group meeting planner',
    'find meeting location',
    'central meeting point calculator',
    'where to meet friends',
    'compare travel times',
    'fair meeting location',
    'visual meeting planning',
    'optimal meeting venue finder',
  ] as string[],
  author: 'Where2Meet',
  locale: 'en_US',
  themeColor: '#FF6B6B', // coral-500
};
```

### Environment Variables

Add to `.env.local`:

```bash
# App URL (required)
NEXT_PUBLIC_APP_URL=https://where2meet.com

# Google Analytics 4 Measurement ID (optional)
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

---

## Implementation Details

### 1. Root Layout (`/src/app/layout.tsx`)

**Features:**

- Comprehensive Open Graph & Twitter Card metadata
- Organization schema (JSON-LD)
- Google Analytics 4 integration
- Theme color and viewport configuration

**Key Metadata:**

```typescript
export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.url),
  title: {
    default: 'Where2Meet - Meeting Spot Finder & Group Planner',
    template: '%s | Where2Meet',
  },
  description: SITE_CONFIG.description,
  keywords: SITE_CONFIG.keywords,
  openGraph: {
    /* ... */
  },
  twitter: {
    /* ... */
  },
  robots: {
    /* ... */
  },
};
```

### 2. Landing Page (`/src/app/(landing)/layout.tsx`)

**Features:**

- Keyword-optimized metadata
- WebSite schema (JSON-LD)
- Landing-specific Open Graph image

**SEO Content:**

```typescript
export const metadata: Metadata = createMetadata({
  title: 'Find the Perfect Meeting Spot for Your Group',
  description:
    'Where2Meet helps you find fair meeting locations by comparing travel times for all participants. Visualize routes, discover venues, and plan better group meetings with our smart meeting spot finder.',
  keywords: [
    /* expanded keyword list */
  ],
  image: '/og-landing.png',
  canonical: '/',
});
```

**Semantic HTML:**

- `<section aria-label="Features">` for feature cards
- `<article>` for individual feature items
- `aria-hidden="true"` for decorative emojis

### 3. Meeting Pages (`/src/app/meet/[id]/layout.tsx`)

**Features:**

- Dynamic metadata based on event data
- noindex/follow strategy for social sharing
- Fallback metadata for error cases

**Dynamic Metadata:**

```typescript
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  try {
    const { id } = await params;
    const event = await eventClient.get(id);

    // Generate dynamic title/description
    return createMeetingMetadata({
      title: `${event.title} - Meeting Planner`,
      description: `Join the meeting "${event.title}"...`,
      canonical: `/meet/${id}`,
    });
  } catch (error) {
    return createMeetingMetadata({
      /* fallback */
    });
  }
}
```

**Critical h1 Tag:**
Location: `/src/features/meeting/ui/header/index.tsx`

```typescript
export function Header({ eventId }: HeaderProps) {
  const { currentEvent } = useMeetingStore();

  return (
    <header>
      {/* SEO: Hidden h1 with event title for search engines */}
      <h1 className="sr-only">{currentEvent?.title || 'Meeting Event'}</h1>
      {/* ... */}
    </header>
  );
}
```

### 4. Private Pages (Dashboard & Auth)

**Dashboard (`/src/app/dashboard/layout.tsx`):**

```typescript
export const metadata: Metadata = createMetadata({
  title: 'Dashboard',
  description: 'Manage your Where2Meet events and settings',
  noIndex: true, // Prevent indexing
});
```

**Auth Pages (`/src/app/auth/layout.tsx`):**

```typescript
export const metadata: Metadata = createMetadata({
  title: 'Authentication',
  description: 'Sign in or create an account on Where2Meet',
  noIndex: true,
});
```

### 5. Static SEO Files

**robots.txt (`/public/robots.txt`):**

```txt
User-agent: *
Allow: /

# Disallow private pages
Disallow: /dashboard
Disallow: /dashboard/*
Disallow: /auth/
Disallow: /api/

Sitemap: https://where2meet.com/sitemap.xml
Crawl-delay: 1
```

**Sitemap (`/src/app/sitemap.ts`):**

```typescript
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://where2meet.com';

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
  ];
}
```

**Note:** Meeting pages (`/meet/[id]`) are intentionally excluded from sitemap because:

- User-generated, mostly private/temporary
- Have noindex directive
- Would expose private event IDs
- Discovered through shared links instead

### 6. Structured Data (JSON-LD)

**Organization Schema** (Root Layout):

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Where2Meet",
  "url": "https://where2meet.com",
  "logo": "https://where2meet.com/logo.png",
  "description": "Find the perfect meeting spot for everyone"
}
```

**WebSite Schema** (Landing Page):

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Where2Meet",
  "url": "https://where2meet.com",
  "description": "Find the perfect meeting spot for everyone"
}
```

**Event Schema** (Meeting Pages - OPTIONAL):
⚠️ Event schema is **NOT currently implemented** for meeting pages. Use conservatively:

- Only for public, ticketed events with confirmed venues
- OR use minimal fields only: name, startDate, organizer
- Rich Results are a bonus, not critical for SEO success
- Focus on Open Graph and h1 tags instead

### 7. Web App Manifest (`/src/app/manifest.ts`)

PWA-like appearance with:

- Add to home screen capability
- Theme colors
- App icons configuration

---

## Google Analytics Setup

### 1. Create GA4 Property

1. Visit https://analytics.google.com
2. Create new GA4 property for Where2Meet
3. Get Measurement ID (format: `G-XXXXXXXXXX`)

### 2. Configure Environment

Add to `.env.local`:

```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 3. Implementation

**Component:** `/src/components/analytics/google-analytics.tsx`

- Uses Next.js Script component for optimization
- `strategy="afterInteractive"` for non-blocking load
- Tracks page views automatically
- Conditional rendering (only loads if env var is set)

**Integration:** Automatically loaded in root layout if `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set.

### 4. Custom Event Tracking (Optional)

Location: `/src/lib/analytics/events.ts`

**Available Events:**

```typescript
import { analyticsEvents } from '@/lib/analytics/events';

// Track event creation
analyticsEvents.createEvent(eventId);

// Track participant joins
analyticsEvents.joinEvent(eventId, participantId);

// Track location additions
analyticsEvents.addLocation(eventId, address);

// Track venue votes
analyticsEvents.voteVenue(eventId, venueId, 'up' | 'down');

// Track meeting publish
analyticsEvents.publishMeeting(eventId, venueId);

// Track event sharing
analyticsEvents.shareEvent(eventId, 'link' | 'social');
```

**Integration Points:**

- Landing page: after event creation
- Meeting page: participant joins, location adds, votes
- Share modal: link copied, social share

---

## Asset Requirements

### Social Sharing Images

Create these images for optimal social sharing:

| File                        | Size       | Purpose                  |
| --------------------------- | ---------- | ------------------------ |
| `/public/og-image.png`      | 1200×630px | Default Open Graph image |
| `/public/og-landing.png`    | 1200×630px | Landing page specific    |
| `/public/twitter-image.png` | 1200×600px | Twitter Card image       |

**Design Guidelines:**

- Include Where2Meet logo + cat mascot
- Tagline: "Find the Perfect Meeting Spot"
- Visual: Map with location pins
- Brand color: Coral (#FF6B6B)
- High contrast text for readability

### App Icons

| File                           | Size         | Purpose         |
| ------------------------------ | ------------ | --------------- |
| `/public/favicon.ico`          | 32×32, 16×16 | Browser favicon |
| `/public/apple-touch-icon.png` | 180×180      | Apple devices   |
| `/public/icon-192.png`         | 192×192      | PWA manifest    |
| `/public/icon-512.png`         | 512×512      | PWA manifest    |

---

## Testing & Verification

### Pre-Deployment Checklist

- [ ] **Environment Variables**
  - [ ] `NEXT_PUBLIC_APP_URL` set to production URL
  - [ ] `NEXT_PUBLIC_GA_MEASUREMENT_ID` configured (if using analytics)

- [ ] **Visual Assets Created**
  - [ ] `/public/og-image.png`
  - [ ] `/public/og-landing.png`
  - [ ] `/public/twitter-image.png`
  - [ ] `/public/favicon.ico`
  - [ ] `/public/apple-touch-icon.png`
  - [ ] `/public/icon-192.png` & `/public/icon-512.png`

- [ ] **Static Files Accessible**
  - [ ] `https://where2meet.com/robots.txt`
  - [ ] `https://where2meet.com/sitemap.xml`
  - [ ] `https://where2meet.com/manifest.webmanifest`

### Post-Deployment Verification

#### 1. Metadata Verification

View page source for each route type:

**Landing Page:**

```bash
curl https://where2meet.com | grep -A 10 "<meta"
```

Check for:

- `<title>Where2Meet - Meeting Spot Finder & Group Planner</title>`
- `<meta name="description" content="...">`
- `<meta property="og:title" content="...">` (Open Graph)
- `<meta name="twitter:card" content="summary_large_image">`
- `<script type="application/ld+json">` (Organization schema)

**Meeting Page:**

```bash
curl https://where2meet.com/meet/abc123 | grep "robots"
```

Check for:

- `<meta name="robots" content="noindex, follow">`
- Dynamic title with event name
- Open Graph tags with event details

**Dashboard/Auth Pages:**

```bash
curl https://where2meet.com/dashboard | grep "robots"
```

Check for:

- `<meta name="robots" content="noindex, nofollow">`

#### 2. Social Sharing Tests

**Facebook Debugger:**
https://developers.facebook.com/tools/debug/

- Test landing page URL
- Test a meeting page URL
- Verify images load correctly
- Check title and description

**Twitter Card Validator:**
https://cards-validator.twitter.com/

- Test landing page URL
- Verify "summary_large_image" card appears
- Check image, title, description

**LinkedIn Post Inspector:**
https://www.linkedin.com/post-inspector/

#### 3. Structured Data Validation

**Google Rich Results Test:**
https://search.google.com/test/rich-results

Test landing page for:

- ✅ Organization schema
- ✅ WebSite schema

**Schema.org Validator:**
https://validator.schema.org/

Paste page source and verify schemas are valid.

#### 4. Lighthouse SEO Audit

```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run SEO audit
lighthouse https://where2meet.com --only-categories=seo --output=html --output-path=./seo-audit.html
```

**Target Score:** 90+

**Key Metrics:**

- ✅ Page has a `<title>` element
- ✅ Document has a `<meta name="description">`
- ✅ Links have descriptive text
- ✅ Page has successful HTTP status code
- ✅ Document has a valid `hreflang`
- ✅ Page has valid robots.txt
- ✅ Image elements have `[alt]` attributes

#### 5. Mobile-Friendliness Test

https://search.google.com/test/mobile-friendly

Verify:

- ✅ Page is mobile-friendly
- ✅ Text is readable without zooming
- ✅ Content fits screen
- ✅ Links are not too close together

---

## Google Search Console Setup

### 1. Add Property

1. Visit https://search.google.com/search-console
2. Click "Add Property"
3. Enter `https://where2meet.com`
4. Choose verification method: **HTML tag**

### 2. Verify Ownership

Add verification meta tag to `/src/app/layout.tsx`:

```typescript
export const metadata: Metadata = {
  // ... existing metadata
  verification: {
    google: 'YOUR_VERIFICATION_CODE_HERE',
  },
};
```

### 3. Submit Sitemap

1. In Search Console, go to "Sitemaps"
2. Add new sitemap: `https://where2meet.com/sitemap.xml`
3. Submit

### 4. Monitor

**Check these sections regularly:**

- **Coverage:** Ensure landing page is indexed
- **Enhancements:** Check for structured data issues
- **Performance:** Monitor search queries and CTR
- **Indexing:** Verify noindex pages are excluded

**Expected Indexing:**

- ✅ Indexed: Landing page (`/`)
- ❌ Excluded: Meeting pages (noindex)
- ❌ Excluded: Dashboard pages (noindex + disallowed)
- ❌ Excluded: Auth pages (noindex + disallowed)

---

## Maintenance

### Regular Tasks

**Monthly:**

- [ ] Review Search Console performance
- [ ] Check for crawl errors
- [ ] Monitor keyword rankings
- [ ] Review GA4 organic traffic data

**Quarterly:**

- [ ] Run Lighthouse SEO audit
- [ ] Update keywords if needed
- [ ] Review and update meta descriptions
- [ ] Check competitor rankings

**Annually:**

- [ ] Comprehensive SEO audit
- [ ] Update structured data if schema.org changes
- [ ] Review and refresh social sharing images

### Updating Metadata

To update site-wide metadata, edit `/src/lib/seo/metadata.ts`:

```typescript
export const SITE_CONFIG = {
  // Update these values
  description: 'New description...',
  keywords: ['new', 'keywords', '...'],
  // ...
};
```

To update page-specific metadata, edit the respective layout file:

- Landing: `/src/app/(landing)/layout.tsx`
- Meeting: `/src/app/meet/[id]/layout.tsx`
- Dashboard: `/src/app/dashboard/layout.tsx`

### Adding New Pages

When adding new public pages:

1. **Create layout with metadata:**

```typescript
// /src/app/new-page/layout.tsx
import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Page Title',
  description: 'Page description...',
  canonical: '/new-page',
});

export default function NewPageLayout({ children }) {
  return children;
}
```

2. **Add to sitemap** (if should be indexed):

```typescript
// /src/app/sitemap.ts
export default function sitemap() {
  return [
    // ... existing entries
    {
      url: `${baseUrl}/new-page`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];
}
```

3. **Add semantic HTML:**

```typescript
<main>
  <h1>Page Heading</h1>
  <section aria-label="Section Name">
    {/* content */}
  </section>
</main>
```

### Keyword Optimization

To target new keywords:

1. **Update SITE_CONFIG keywords:**

```typescript
keywords: [
  'existing keyword',
  'new keyword to target',
  // ...
];
```

2. **Update meta descriptions** to naturally include new keywords

3. **Update h1/h2 headings** on landing page if appropriate

4. **Monitor in Search Console** after 2-4 weeks

---

## Expected Outcomes

### Short-term (1-2 months)

- ✅ All public pages indexed by Google
- ✅ Proper social media link previews on Twitter/Facebook/LinkedIn
- ✅ Lighthouse SEO score: 90+
- ✅ GA4 tracking functional with page views
- ✅ Rich Results eligible (Organization, WebSite schemas)

**Success Metrics:**

- Landing page appears in Google search results
- Search Console shows no critical errors
- Social sharing previews render correctly
- GA4 tracking user sessions

### Medium-term (3-6 months)

- 📈 Ranking on page 2-3 for "meeting spot finder"
- 📈 Ranking on page 2-3 for "group meeting planner"
- 📈 Organic traffic: 100-500 visits/month
- 📈 Improved CTR from search results

**Success Metrics:**

- 10+ search queries showing impressions in Search Console
- Avg. position improving (lower is better)
- Organic sessions in GA4 increasing month-over-month

### Long-term (6-12 months)

- 🎯 Top 10 ranking for primary keywords
- 🎯 Organic traffic: 1000+ visits/month
- 🎯 Featured snippets for "how to find meeting spot"
- 🎯 Brand searches for "Where2Meet"

**Success Metrics:**

- Multiple keywords in top 10 positions
- Branded search queries appearing
- High-quality backlinks from relevant sites
- Strong organic conversion rate

---

## Troubleshooting

### Pages Not Being Indexed

**Check:**

1. Search Console Coverage report for errors
2. `robots.txt` not blocking the page
3. No `noindex` meta tag on the page
4. Sitemap includes the URL
5. Page returns 200 status code

**Solutions:**

- Request indexing in Search Console
- Check for server errors (500, 404)
- Verify canonical URL is correct

### Social Sharing Images Not Loading

**Check:**

1. Image files exist in `/public/` directory
2. Image URLs are absolute (include domain)
3. Images are the correct size (1200×630 for OG)
4. Images are publicly accessible

**Debug:**

```bash
curl -I https://where2meet.com/og-image.png
```

Should return `200 OK`.

### Lighthouse Score Below 90

**Common Issues:**

- Missing `alt` attributes on images
- Missing meta description
- Links without descriptive text
- No `hreflang` for internationalization (if applicable)

**Fix:**
Review Lighthouse report for specific issues and address each one.

### GA4 Not Tracking

**Check:**

1. `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set in production
2. Environment variable starts with `NEXT_PUBLIC_` (required for client-side)
3. Ad blockers disabled when testing
4. Check browser console for errors

**Debug:**

```javascript
// In browser console
window.dataLayer;
// Should show array with events
```

---

## Architecture Decisions

### Why noindex/follow for Meeting Pages?

**Problem:** Meeting pages are user-generated, often private/temporary, and could dilute site authority with low-quality content.

**Solution:** `robots: { index: false, follow: true }`

**Benefits:**

- ✅ Prevents spam event pages from ranking
- ✅ Keeps SEO power concentrated on landing page
- ✅ Google still crawls for Open Graph tags
- ✅ Shared links render beautifully on social media
- ✅ No wasted crawl budget on temporary pages

**Future:** When "Public Events" feature is added, change to `index: true` for public events only.

### Why Exclude Meeting Pages from Sitemap?

**Reasons:**

- User-generated content (potentially millions of URLs)
- Mostly private/temporary events
- Have noindex directive anyway
- Would expose private event IDs
- Search engines discover through shared links

**Alternative:** If "Public Events" feature is added, create a separate dynamic sitemap:

```typescript
// /src/app/sitemap-events.xml/route.ts
export async function GET() {
  const publicEvents = await getPublicEvents();
  // Generate dynamic sitemap
}
```

### Why Conservative Event Schema Approach?

**Issue:** Google may ignore Event schema for non-public events without full details (venue, tickets, etc.).

**Decision:** Skip Event schema for now, focus on Open Graph + h1 tags.

**Rationale:**

- Rich Results are a bonus, not critical for SEO success
- Missing required fields (venue address, event status) would cause warnings
- Open Graph provides sufficient metadata for social sharing
- Can add Event schema later when "Public Events" feature exists

---

## Files Reference

### Created Files

**SEO Core:**

- `/src/lib/seo/metadata.ts` - SEO utilities and site config
- `/src/lib/seo/structured-data.ts` - JSON-LD schema generators
- `/src/components/seo/structured-data.tsx` - Schema injection component

**Analytics:**

- `/src/components/analytics/google-analytics.tsx` - GA4 component
- `/src/lib/analytics/events.ts` - Custom event tracking

**Static SEO:**

- `/public/robots.txt` - Crawler directives
- `/src/app/sitemap.ts` - XML sitemap generator
- `/src/app/manifest.ts` - PWA manifest

**Layouts:**

- `/src/app/(landing)/layout.tsx` - Landing page metadata
- `/src/app/meet/[id]/layout.tsx` - Meeting page dynamic metadata
- `/src/app/auth/layout.tsx` - Auth pages noindex

### Modified Files

- `/src/app/layout.tsx` - Enhanced root metadata, GA4, Organization schema
- `/src/app/dashboard/layout.tsx` - Added noindex
- `/src/features/meeting/ui/header/index.tsx` - Added h1 tag
- `/src/app/(landing)/page.tsx` - Semantic HTML
- `.env.example` - Added GA4 variable

---

## Resources

**Documentation:**

- [Next.js Metadata API](https://nextjs.org/docs/app/building-your-application/optimizing/metadata)
- [Schema.org Documentation](https://schema.org/)
- [Google Search Central](https://developers.google.com/search)
- [Open Graph Protocol](https://ogp.me/)

**Tools:**

- [Google Search Console](https://search.google.com/search-console)
- [Google Analytics 4](https://analytics.google.com)
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-validator.twitter.com/)
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Lighthouse CLI](https://github.com/GoogleChrome/lighthouse)

**Learning:**

- [Moz SEO Learning Center](https://moz.com/learn/seo)
- [Google SEO Starter Guide](https://developers.google.com/search/docs/beginner/seo-starter-guide)
- [Next.js SEO Best Practices](https://nextjs.org/learn/seo/introduction-to-seo)

---

## Support & Questions

For SEO-related issues or questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review Google Search Console for specific errors
3. Run Lighthouse audit for detailed recommendations
4. Consult Next.js metadata documentation

---

**Last Updated:** 2025-12-28
**Version:** 1.0.0
**Maintained By:** Where2Meet Team
