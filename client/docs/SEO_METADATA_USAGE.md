# SEO Metadata Usage Guide

This guide shows how to use the optimized metadata system in Where2Meet.

## Overview

The metadata system (`src/lib/seo/metadata.ts`) provides:

1. **Differentiated Positioning**: Emphasizes "Fair Meeting Planning + Travel Time Comparison"
2. **Strategic Keywords**: Organized by category (core, differentiation, AI, features)
3. **Absolute URLs**: For OG/Twitter images (better social sharing)
4. **Flexible Canonical**: Supports both relative paths and full URLs
5. **Smart Robots**: GoogleBot-specific settings for better control
6. **i18n Ready**: Language alternates structure for future internationalization

## SITE_CONFIG

The core configuration with differentiated positioning:

```typescript
import { SITE_CONFIG } from '@/lib/seo/metadata';

// Optimized for "Fair + Travel Time Comparison" positioning
SITE_CONFIG.defaultTitle; // "Where2Meet – Fair Meeting Planner with Travel Time Comparison"
SITE_CONFIG.description; // Emphasizes fairness, travel time, and visualization
SITE_CONFIG.allKeywords; // All keywords combined
SITE_CONFIG.keywords.differentiation; // Fair travel time keywords
SITE_CONFIG.keywords.core; // Generic meeting planner keywords
SITE_CONFIG.keywords.ai; // AI-powered keywords
SITE_CONFIG.keywords.features; // Feature-specific keywords
```

## Usage Examples

### 1. Landing Page (Root Layout - Already Implemented)

The root layout (`src/app/layout.tsx`) uses the optimized SITE_CONFIG:

```typescript
export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.url),
  title: {
    default: SITE_CONFIG.defaultTitle,
    template: '%s | Where2Meet – Fair Meeting Planner',
  },
  description: SITE_CONFIG.description,
  keywords: SITE_CONFIG.allKeywords,
  // ... OG images now use absolute URLs
};
```

### 2. Meeting Pages (User-Generated Content)

For dynamic meeting pages (e.g., `/meet/[id]`), use the preset for noindex pages:

**Server Component Example** (`src/app/meet/[id]/page.tsx`):

```typescript
import { createMeetingPageMetadata } from '@/lib/seo/metadata';
import type { Metadata } from 'next';

// ⚠️ Note: This requires converting the page to a Server Component
// Remove 'use client' directive and use generateMetadata()

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Fetch meeting data
  const meeting = await eventClient.get(params.id);

  return createMeetingPageMetadata({
    title: meeting.title,
    description: `Join ${meeting.participants.length} participants to find a fair meeting spot. Compare travel times and vote on venues.`,
    canonical: `/meet/${params.id}`,
    image: `/og/meeting/${params.id}.png`, // Dynamic OG image if available
  });
}

// This automatically includes:
// - robots: { index: false, follow: true }
// - googleBot: { index: false, follow: true }
// - keywordsFocus: 'differentiation' (fair travel time keywords)
```

**Current Workaround (Client Component)**:

Since your current page is a client component, you can add metadata in a parent layout:

Create `src/app/meet/layout.tsx`:

```typescript
import { createMeetingPageMetadata } from '@/lib/seo/metadata';
import type { Metadata } from 'next';

export const metadata: Metadata = createMeetingPageMetadata({
  title: 'Meeting Planning',
  description:
    'Find a fair meeting spot with equal travel time for everyone. Compare commute distances and visualize optimal locations.',
  canonical: '/meet',
});

export default function MeetLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

### 3. Blog/Article Pages

For blog posts and articles that should be indexed:

```typescript
import { createArticleMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getBlogPost(params.slug);

  return createArticleMetadata({
    title: post.title,
    description: post.excerpt,
    canonical: `/blog/${params.slug}`,
    image: post.featuredImage,
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt,
    authors: [post.author.name],
    tags: post.tags,
  });
}

// This automatically includes:
// - robots: { index: true, follow: true }
// - ogType: 'article'
// - article structured data
// - keywordsFocus: 'core' (generic meeting planner keywords)
```

### 4. Feature/Landing Pages

For feature pages and marketing pages:

```typescript
import { createFeaturePageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createFeaturePageMetadata({
  title: 'Travel Time Visualization',
  description:
    'See real-time travel times on an interactive map. Compare routes, distances, and find the fairest meeting location for your group.',
  canonical: '/features/travel-time-visualization',
  keywords: ['real-time travel times', 'route comparison', 'interactive map'],
});

// This automatically includes:
// - robots: { index: true, follow: true }
// - keywordsFocus: 'features' (feature-specific keywords prioritized)
```

### 5. Custom Page with Manual Control

For pages that need full control:

```typescript
import { createMetadata, SITE_CONFIG } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'About Us',
  description: 'Learn about Where2Meet and our mission to make meeting planning fair for everyone.',
  canonical: '/about',
  image: '/images/about-og.png',

  // Custom keyword prioritization
  keywordsFocus: 'ai', // Emphasize AI keywords
  keywords: ['team collaboration', 'meeting equity'], // Add custom keywords

  // Custom robots
  robots: {
    index: true,
    follow: true,
  },

  // Future: i18n support
  languages: {
    en: '/about',
    zh: '/zh/about',
  },
});
```

### 6. Dynamic OG Images

For pages with dynamic Open Graph images:

```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return createMetadata({
    title: 'Meeting Results',
    description: 'View the optimal meeting location based on fair travel times.',

    // Relative path - automatically converted to absolute URL
    image: `/api/og?eventId=${params.id}`,
    imageAlt: 'Meeting location map with travel time visualization',
  });
}
```

## Canonical URL Handling

The system intelligently handles canonical URLs:

```typescript
// Relative path - automatically converted to full URL
canonical: '/about';
// → https://where2meet.org/about

// Full URL - used as-is
canonical: 'https://where2meet.org/about';
// → https://where2meet.org/about

// Also works for OG images
image: '/og-image.png';
// → https://where2meet.org/og-image.png
```

## Keyword Strategy

Keywords are prioritized based on page focus:

```typescript
// Meeting pages - emphasize fairness
keywordsFocus: 'differentiation';
// → fair meeting planner, travel time comparison, equal commute...

// Blog posts - generic keywords
keywordsFocus: 'core';
// → meeting spot finder, central meeting point, group planner...

// Feature pages - feature-specific
keywordsFocus: 'features';
// → visual map planner, travel time visualization, meeting cost calculator...

// AI-focused pages
keywordsFocus: 'ai';
// → AI meeting planner, smart location finder, intelligent venue...
```

Keywords are automatically deduplicated and combined with custom keywords.

## Robots Configuration

### Public Pages (Should be indexed)

```typescript
robots: {
  index: true,
  follow: true,
}
```

Used for:

- Landing page
- Feature pages
- Blog posts
- Help/FAQ pages

### User-Generated Content (Should NOT be indexed)

```typescript
robots: {
  index: false,  // Don't index to avoid duplicate content
  follow: true,  // Allow following links for internal equity
}
```

Used for:

- Meeting pages (`/meet/[id]`)
- User profiles (if any)
- Search results pages

**Important**: OG crawlers (Facebook, Twitter) do NOT rely on `robots` meta. They fetch pages directly for social sharing previews.

## i18n Support (Future)

The system is ready for internationalization:

```typescript
export const metadata: Metadata = createMetadata({
  title: 'About Us',
  canonical: '/about',

  // Define language alternates
  languages: {
    en: '/about',
    zh: '/zh/about',
    ja: '/ja/about',
  },
});

// Generates:
// <link rel="alternate" hreflang="en" href="https://where2meet.org/about" />
// <link rel="alternate" hreflang="zh" href="https://where2meet.org/zh/about" />
// <link rel="alternate" hreflang="ja" href="https://where2meet.org/ja/about" />
```

## Testing Metadata

### 1. Verify in Browser

```bash
# View page source and check meta tags
# Look for:
# - <title>
# - <meta name="description">
# - <meta property="og:*">
# - <meta name="twitter:*">
# - <link rel="canonical">
```

### 2. Test Social Sharing

**Facebook Debugger**: https://developers.facebook.com/tools/debug/

```
Enter URL → Fetch new information
Check OG tags and preview
```

**Twitter Card Validator**: https://cards-dev.twitter.com/validator

```
Enter URL → Preview card
Verify title, description, image
```

**LinkedIn Post Inspector**: https://www.linkedin.com/post-inspector/

```
Enter URL → Inspect
Check shared post preview
```

### 3. Google Search Console

```
Submit sitemap.xml
Monitor indexed pages
Check for duplicate content issues
Verify canonical tags are working
```

## Migration Checklist

If you're migrating existing pages to use this system:

- [ ] Replace hardcoded SITE_CONFIG values with imports
- [ ] Update title to use `SITE_CONFIG.defaultTitle`
- [ ] Change OG/Twitter images to absolute URLs
- [ ] Add canonical URLs to all public pages
- [ ] Use appropriate preset (`createMeetingPageMetadata`, `createArticleMetadata`, etc.)
- [ ] Set correct `robots` configuration (index vs noindex)
- [ ] Choose appropriate `keywordsFocus` for each page type
- [ ] Test social sharing previews
- [ ] Verify in Google Search Console

## Common Patterns

### Pattern 1: Static Public Page

```typescript
export const metadata = createFeaturePageMetadata({
  title: 'Page Title',
  description: '...',
  canonical: '/page-path',
});
```

### Pattern 2: Dynamic Public Page

```typescript
export async function generateMetadata({ params }) {
  const data = await fetchData(params.id);
  return createMetadata({
    title: data.title,
    description: data.description,
    canonical: `/path/${params.id}`,
    robots: { index: true, follow: true },
  });
}
```

### Pattern 3: Dynamic NoIndex Page

```typescript
export async function generateMetadata({ params }) {
  const data = await fetchData(params.id);
  return createMeetingPageMetadata({
    title: data.title,
    description: data.description,
    canonical: `/meet/${params.id}`,
  });
}
```

## Best Practices

1. **Always use canonical URLs** for public pages to prevent duplicate content
2. **NoIndex user-generated content** to avoid SEO spam/thin content
3. **Use absolute URLs** for OG/Twitter images (better social platform support)
4. **Choose appropriate keywordsFocus** based on page intent
5. **Test social sharing** after implementing metadata
6. **Monitor Search Console** for indexing issues
7. **Keep descriptions under 160 characters** for better SERP display
8. **Make titles under 60 characters** when possible
9. **Use unique descriptions** for each page (don't reuse)
10. **Update `modifiedTime`** when editing article content

## Troubleshooting

### OG Image Not Showing in Social Share

- Verify image URL is absolute (starts with `https://`)
- Check image exists and is accessible
- Use Facebook Debugger to re-scrape
- Ensure image meets platform requirements (1200x630 for OG)

### Page Not Being Indexed

- Check `robots` meta tag (`index: true`?)
- Verify in Search Console
- Check sitemap.xml includes the page
- Ensure canonical URL is correct

### Duplicate Content Issues

- Add canonical URLs to all pages
- Use `noindex` for user-generated content
- Check for URL variations (trailing slash, www vs non-www)

### Keywords Not Working

- Keywords meta tag is a weak SEO signal
- Focus on content quality and H1/H2 tags instead
- Use keywords in title and description naturally
- Don't keyword stuff

## Resources

- [Next.js Metadata Docs](https://nextjs.org/docs/app/building-your-application/optimizing/metadata)
- [Open Graph Protocol](https://ogp.me/)
- [Twitter Cards](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)
- [Google Search Central](https://developers.google.com/search)
- [Schema.org](https://schema.org/) (for structured data)
