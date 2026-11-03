'use client';

/**
 * English and Simplified Chinese UI text. Meetings in mainland China (Amap)
 * show Chinese to everyone; all other meetings show English.
 *
 * Each component keeps its own strings next to it:
 *
 *   const messages = defineMessages({ en: { save: 'Save' }, zh: { save: '保存' } });
 *   const t = useMessages(messages);
 */

import { createContext, useContext, type ReactNode } from 'react';
import { enUS, zhCN, type Locale as DateFnsLocale } from 'date-fns/locale';
import type { MapProvider } from '@/shared/types/map';

export type Locale = 'en' | 'zh';

/** For date-fns `format` and react-day-picker. */
export const DATE_FNS_LOCALES: Record<Locale, DateFnsLocale> = { en: enUS, zh: zhCN };

/** For Intl formatters and the `lang` attribute. */
export const LANGUAGE_TAGS: Record<Locale, string> = { en: 'en-US', zh: 'zh-CN' };

export function localeFor(provider: MapProvider | undefined): Locale {
  return provider === 'amap' ? 'zh' : 'en';
}

const LocaleContext = createContext<Locale>('en');

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** English is the source shape; Chinese must have every key with the same type. */
export function defineMessages<T>(messages: { en: T; zh: NoInfer<T> }): Record<Locale, T> {
  return messages;
}

export function useMessages<T>(messages: Record<Locale, T>): T {
  return messages[useLocale()];
}
