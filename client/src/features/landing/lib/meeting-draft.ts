export interface MeetingDraft {
  title: string;
  meetingTime: string;
  organizerName: string;
}

const REQUIRED_DETAILS: readonly { label: string; filled: (draft: MeetingDraft) => boolean }[] = [
  { label: 'the occasion', filled: ({ title }) => title !== '' },
  { label: 'a time', filled: ({ meetingTime }) => meetingTime !== '' },
  { label: 'your name', filled: ({ organizerName }) => organizerName.trim() !== '' },
];

export function missingDetailsMessage(draft: MeetingDraft): string | null {
  const missing = REQUIRED_DETAILS.filter(({ filled }) => !filled(draft)).map(({ label }) => label);
  if (missing.length === 0) return null;
  const list =
    missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(', ')} and ${missing.at(-1)}`;
  return `Add ${list} to create the meeting.`;
}
