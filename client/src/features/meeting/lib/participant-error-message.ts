import { APIError } from '@/lib/api/client';
import type { Locale } from '@/shared/lib/i18n';

const MESSAGES: Record<Locale, Record<'notFound' | 'published' | 'unreachable', string>> = {
  en: {
    notFound: 'We couldn’t find that address. Pick a suggestion or try a nearby landmark.',
    published: 'This meeting is already finalized, so people can’t be changed anymore.',
    unreachable: 'We couldn’t reach the map service. Check your connection and try again.',
  },
  zh: {
    notFound: '找不到这个地址。请从建议中选择，或试试附近的地标。',
    published: '这个见面已经确定，不能再更改参与者。',
    unreachable: '无法连接地图服务，请检查网络后重试。',
  },
};

/**
 * User-facing message for a failed add/update of a participant's details.
 *
 * Server messages are written for developers ("Could not geocode address: …"),
 * so the common, actionable cases get plain wording; anything else falls back
 * to the server's message or the caller's fallback.
 */
export function participantErrorMessage(
  error: unknown,
  fallback: string,
  locale: Locale = 'en'
): string {
  const messages = MESSAGES[locale];
  if (error instanceof APIError) {
    switch (error.code) {
      case 'ADDRESS_NOT_FOUND':
        return messages.notFound;
      case 'EVENT_ALREADY_PUBLISHED':
        return messages.published;
      case 'EXTERNAL_SERVICE_ERROR':
      case 'NETWORK_ERROR':
        return messages.unreachable;
    }
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
