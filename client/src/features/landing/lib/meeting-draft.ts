import type { Locale } from '@/shared/lib/i18n';

export interface MeetingDraft {
  title: string;
  meetingTime: string;
  organizerName: string;
}

const REQUIRED_DETAILS: readonly {
  label: Record<Locale, string>;
  filled: (draft: MeetingDraft) => boolean;
}[] = [
  { label: { en: 'the occasion', zh: '活动' }, filled: ({ title }) => title !== '' },
  { label: { en: 'a time', zh: '时间' }, filled: ({ meetingTime }) => meetingTime !== '' },
  {
    label: { en: 'your name', zh: '你的名字' },
    filled: ({ organizerName }) => organizerName.trim() !== '',
  },
];

export function missingDetailsMessage(draft: MeetingDraft, locale: Locale = 'en'): string | null {
  const missing = REQUIRED_DETAILS.filter(({ filled }) => !filled(draft)).map(
    ({ label }) => label[locale]
  );
  if (missing.length === 0) return null;
  if (locale === 'zh') return `请填写${missing.join('、')}后再创建。`;
  const list =
    missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(', ')} and ${missing.at(-1)}`;
  return `Add ${list} to create the meeting.`;
}
