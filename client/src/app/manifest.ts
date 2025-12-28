import type { MetadataRoute } from 'next';
import { SITE_CONFIG } from '@/lib/seo/metadata';

/**
 * Web App Manifest for PWA-like appearance
 *
 * Features:
 * - Adds to home screen capability
 * - Splash screen configuration
 * - Theme colors for mobile browsers
 * - App icons for different sizes
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Where2Meet - Meeting Spot Finder',
    short_name: 'Where2Meet',
    description: SITE_CONFIG.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: SITE_CONFIG.themeColor,
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
