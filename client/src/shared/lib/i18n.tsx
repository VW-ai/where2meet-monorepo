'use client';

/**
 * The locale for the React tree. Each component keeps its own strings next to it:
 *
 *   const messages = defineMessages({ en: { save: 'Save' }, zh: { save: '保存' } });
 *   const t = useMessages(messages);
 */

import { createContext, useContext, type ReactNode } from 'react';
import { enUS, zhCN, type Locale as DateFnsLocale } from 'date-fns/locale';
import type { Locale } from '@/shared/lib/locale';

export { LANGUAGE_TAGS, defineMessages, localeFor, type Locale } from '@/shared/lib/locale';

/** For date-fns `format` and react-day-picker. */
export const DATE_FNS_LOCALES: Record<Locale, DateFnsLocale> = { en: enUS, zh: zhCN };

const LocaleContext = createContext<Locale>('en');

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useMessages<T>(messages: Record<Locale, T>): T {
  return messages[useLocale()];
}
