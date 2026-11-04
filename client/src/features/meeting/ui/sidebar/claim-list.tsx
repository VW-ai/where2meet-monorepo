'use client';

import type { Participant } from '@/entities';
import { useClaimParticipant } from '@/features/meeting/hooks/useParticipantActions';
import { defineMessages, useMessages } from '@/shared/lib/i18n';
import { ParticipantAvatar } from './venue-v2-parts';

const messages = defineMessages({
  en: {
    already: 'Already on the list?',
    addedFrom: (from: string, host: string) => `From ${from}, added by ${host}`,
    addedBy: (host: string) => `Added by ${host}`,
    thatsMe: "That's me",
    orNew: 'Or join as someone new',
  },
  zh: {
    already: '名单上已经有你了？',
    addedFrom: (from: string, host: string) => `从${from}出发，${host}添加的`,
    addedBy: (host: string) => `${host}添加的`,
    thatsMe: '这是我',
    orNew: '或者以新成员身份加入',
  },
});

/** The top of the join form: someone the organizer already added can take their row instead. */
export function ClaimList({
  people,
  hostName,
  onClaimed,
}: {
  people: Participant[];
  hostName: string;
  onClaimed: () => void;
}) {
  const t = useMessages(messages);
  const claim = useClaimParticipant();
  if (people.length === 0) return null;
  return (
    <div className="grid gap-[5px]">
      <p className="text-sm font-medium text-foreground">{t.already}</p>
      {people.map((person) => (
        <button
          key={person.id}
          type="button"
          onClick={() => {
            void claim(person);
            onClaimed();
          }}
          className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 rounded-[10px] bg-white px-[9px] py-[7px] text-left shadow-[inset_0_0_0_1px_var(--color-v2-line)] hover:bg-v2-coral-wash"
        >
          <ParticipantAvatar participant={person} />
          <span className="min-w-0">
            <b className="block text-[13px] font-semibold text-v2-ink">{person.name}</b>
            <small className="block truncate text-[11.5px] text-v2-ink-2">
              {person.address ? t.addedFrom(person.address, hostName) : t.addedBy(hostName)}
            </small>
          </span>
          <em className="text-xs font-semibold not-italic text-v2-coral-deep">{t.thatsMe}</em>
        </button>
      ))}
      <p className="mt-2.5 border-t border-v2-line pt-2.5 text-sm font-semibold text-foreground">
        {t.orNew}
      </p>
    </div>
  );
}
