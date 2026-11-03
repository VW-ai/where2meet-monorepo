/**
 * English and Simplified Chinese UI text. Meetings in mainland China (Amap)
 * show Chinese to everyone; all other meetings show English.
 *
 * Kept apart from the React hooks in `./i18n` so server code (route handlers,
 * metadata, OG images) can import these values: anything exported from a
 * 'use client' module is an opaque reference on the server.
 */

import type { MapProvider } from '@/shared/types/map';

export type Locale = 'en' | 'zh';

/** For Intl formatters and the `lang` attribute. */
export const LANGUAGE_TAGS: Record<Locale, string> = { en: 'en-US', zh: 'zh-CN' };

export function localeFor(provider: MapProvider | undefined): Locale {
  return provider === 'amap' ? 'zh' : 'en';
}

/** English is the source shape; Chinese must have every key with the same type. */
export function defineMessages<T>(messages: { en: T; zh: NoInfer<T> }): Record<Locale, T> {
  return messages;
}
