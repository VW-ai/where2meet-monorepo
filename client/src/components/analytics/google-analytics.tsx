'use client';

import Script from 'next/script';

/**
 * Google Analytics 4 component
 *
 * Usage:
 * 1. Create GA4 property at analytics.google.com
 * 2. Get Measurement ID (format: G-XXXXXXXXXX)
 * 3. Add to .env.local as NEXT_PUBLIC_GA_MEASUREMENT_ID
 * 4. Add this component to root layout
 *
 * Features:
 * - Uses Next.js Script component for optimization
 * - strategy="afterInteractive" for non-blocking load
 * - Tracks page views automatically
 */
export function GoogleAnalytics({ gaId }: { gaId: string }) {
  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaId}', {
              page_path: window.location.pathname,
            });
          `,
        }}
      />
    </>
  );
}
