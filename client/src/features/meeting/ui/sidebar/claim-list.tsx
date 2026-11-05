'use client';

import type { Participant } from '@/entities';
import { useClaimParticipant } from '@/features/meeting/hooks/useParticipantActions';
import { defineMessages, useMessages } from '@/shared/lib/i18n';
import { ParticipantAvatar } from './venue-v2-parts';

const messages = defineMessages({
  en: {
    already: 'Already on the list?',
    from: (place: string) => `From ${place}`,
    thatsMe: "That's me",
    orNew: 'Or join as someone new',
  },
  zh: {
    already: '名单上已经有你了？',
    from: (place: string) => `从${place}出发`,
    thatsMe: '这是我',
    orNew: '或者以新成员身份加入',
  },
});

/** The top of the join form: someone the organizer already added can take their row instead. */
export function ClaimList({ people, onClaimed }: { people: Participant[]; onClaimed: () => void }) {
  const t = useMessages(messages);
  const claim = useClaimParticipant();
  if (people.length === 0) return null;
  return (
    <>
      <div className="grid gap-1.5">
        <p className="text-[13px] font-semibold text-v2-ink">{t.already}</p>
        <div className="grid gap-[5px]">
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
                {person.address && (
                  <small className="block truncate text-[11.5px] text-v2-ink-2">
                    {t.from(person.address)}
                  </small>
                )}
              </span>
              <em className="text-xs font-semibold not-italic text-v2-coral-deep">{t.thatsMe}</em>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-0.5 border-t border-v2-line pt-2.5 text-xs font-semibold text-v2-ink-2">
        {t.orNew}
      </p>
    </>
  );
}
