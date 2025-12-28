import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SessionProvider } from '@/features/auth/ui/session-provider';
import { StructuredData } from '@/components/seo/structured-data';
import { generateOrganizationSchema } from '@/lib/seo/structured-data';
import { GoogleAnalytics } from '@/components/analytics/google-analytics';
import { SITE_CONFIG } from '@/lib/seo/metadata';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.url),
  title: {
    default: 'Where2Meet - Meeting Spot Finder & Group Planner',
    template: '%s | Where2Meet',
  },
  description: SITE_CONFIG.description,
  keywords: SITE_CONFIG.keywords,
  authors: [{ name: SITE_CONFIG.author }],
  creator: SITE_CONFIG.author,
  openGraph: {
    type: 'website',
    locale: SITE_CONFIG.locale,
    url: '/',
    siteName: SITE_CONFIG.name,
    title: 'Where2Meet - Meeting Spot Finder & Group Planner',
    description: SITE_CONFIG.description,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Where2Meet - Find the Perfect Meeting Spot',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Where2Meet - Meeting Spot Finder & Group Planner',
    description: SITE_CONFIG.description,
    images: ['/twitter-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  // Add Google Search Console verification code when available
  // verification: {
  //   google: 'YOUR_VERIFICATION_CODE',
  // },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: SITE_CONFIG.themeColor,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="en">
      <body>
        {gaId && <GoogleAnalytics gaId={gaId} />}
        <StructuredData data={generateOrganizationSchema()} />
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
