'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { Event } from '@/entities';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { userClient } from '@/features/user/api';
import { phonePlan } from '@/features/meeting/model/phone-plan-store';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { trackEvent } from '@/lib/analytics/events';
import { defineMessages, useLocale, useMessages, LANGUAGE_TAGS } from '@/shared/lib/i18n';
import { AvatarStack, ParticipantAvatar } from './sidebar/venue-v2-parts';
import catLogo from '@/components/cat/logo.svg';

const messages = defineMessages({
  en: {
    invitedBy: (name: string) => `${name} invited you to`,
    invited: "You're invited to",
    when: 'When',
    noTime: 'Time to be decided',
    going: 'Going',
    nobody: 'Be the first to join',
    names: (first: string[], more: number) =>
      more > 0 ? `${first.join(', ')} and ${more} more` : first.join(' and '),
    placePicked: 'The place is picked',
    pitch: 'Add where you’re coming from and see how far each place is for everyone.',
    join: 'Join this plan',
    look: 'Just look around',
    closed: 'This plan is closed to new people.',
    see: 'See the plan',
  },
  zh: {
    invitedBy: (name: string) => `${name}邀请你参加`,
    invited: '你被邀请参加',
    when: '时间',
    noTime: '时间待定',
    going: '参加',
    nobody: '来做第一个加入的人',
    names: (first: string[], more: number) =>
      more > 0 ? `${first.join('、')}等 ${first.length + more} 人` : first.join('和'),
    placePicked: '地点已经定好了',
    pitch: '填上你从哪里出发，就能看到每个地点离大家有多远。',
    join: '加入计划',
    look: '先随便看看',
    closed: '这个计划不再接受新的人加入。',
    see: '查看计划',
  },
});

const MAX_FACES = 5;
const SEEN_KEY = (eventId: string) => `w2m-invite-seen:${eventId}`;

function wasSeen(eventId: string): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY(eventId)) === '1';
  } catch {
    return false;
  }
}

function markSeen(eventId: string) {
  try {
    window.localStorage.setItem(SEEN_KEY(eventId), '1');
  } catch {
    // Private mode: the card shows again next visit
  }
}

function whenText(event: Event, tag: string): string | null {
  if (!event.meetingTime) return null;
  try {
    return new Intl.DateTimeFormat(tag, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: event.meetingTimeZone ?? undefined,
      timeZoneName: event.meetingTimeZone ? 'short' : undefined,
    }).format(new Date(event.meetingTime));
  } catch {
    return null;
  }
}

// Asks the account whether this meeting is already one of theirs, e.g. joined on another device
function useOnAccount(eventId: string): boolean | null {
  const { isAuthenticated, isAuthInitialized } = useAuthStore();
  const [onAccount, setOnAccount] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isAuthInitialized) return;
    if (!isAuthenticated) {
      setOnAccount(false);
      return;
    }
    let cancelled = false;
    userClient
      .getEvents()
      .then(({ events }) => {
        if (!cancelled) setOnAccount(events.some((ue) => ue.event?.id === eventId));
      })
      .catch(() => {
        if (!cancelled) setOnAccount(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, isAuthenticated, isAuthInitialized]);

  return onAccount;
}

/**
 * What someone opening a shared link sees first: who invited them, to what, and who's in.
 * People already in the meeting on this browser or account go straight to the map.
 */
export function InviteLanding({ eventId, phone }: { eventId: string; phone: boolean }) {
  const t = useMessages(messages);
  const tag = LANGUAGE_TAGS[useLocale()];
  const event = useMeetingStore((state) => state.currentEvent);
  const hasToken = useAuthStore((state) => !!(state.organizerToken || state.participantToken));
  const onAccount = useOnAccount(eventId);
  const open = useUIStore((state) => state.isInviteOpen);
  const setInviteOpen = useUIStore((state) => state.setInviteOpen);

  useEffect(() => {
    if (!event || event.id !== eventId || onAccount === null) return;
    if (hasToken || onAccount || wasSeen(eventId)) return;
    setInviteOpen(true);
    trackEvent('invite_landing_shown', { event_id: eventId });
  }, [event, eventId, hasToken, onAccount, setInviteOpen]);

  // Joining in another tab, or the token loading late, ends the invite
  useEffect(() => {
    if (open && hasToken) setInviteOpen(false);
  }, [open, hasToken, setInviteOpen]);

  if (!open || !event) return null;

  const close = (choice: 'join' | 'look') => {
    markSeen(eventId);
    setInviteOpen(false);
    trackEvent(choice === 'join' ? 'invite_landing_join' : 'invite_landing_browse', {
      event_id: eventId,
    });
    if (choice !== 'join') return;
    if (phone) phonePlan.addSomeone();
    else useUIStore.getState().requestJoinForm();
  };

  const organizer = event.participants.find((p) => p.isOrganizer && p.name.trim());
  const people = event.participants.filter((p) => p.name.trim());
  const faces = people.slice(0, MAX_FACES);
  const when = whenText(event, tag);
  const canJoin = !event.publishedAt || event.settings?.allowParticipantsAfterPublish !== false;

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-[rgba(238,241,244,0.72)] backdrop-blur-[6px] md:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-title"
        className="w-full rounded-t-[28px] bg-white px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 text-[#21252b] shadow-[0_-8px_32px_rgba(23,37,45,0.16)] md:max-w-[400px] md:rounded-[28px] md:pb-6 md:shadow-[0_8px_32px_rgba(23,37,45,0.2)]"
      >
        <Image src={catLogo} alt="" width={44} height={44} className="h-11 w-11" />
        <p className="mt-4 text-[15px] text-[#666b73]">
          {organizer ? t.invitedBy(organizer.name) : t.invited}
        </p>
        <h1
          id="invite-title"
          className="mt-0.5 text-[26px] font-bold leading-tight tracking-[-0.8px] [overflow-wrap:anywhere]"
        >
          {event.title}
        </h1>

        <div className="mt-5 grid grid-cols-2 gap-4 border-y border-dashed border-[#e4e8ed] py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[1.5px] text-[#8b9098]">
              {t.when}
            </p>
            <p className="mt-1 text-sm font-semibold">{when ?? t.noTime}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[1.5px] text-[#8b9098]">
              {t.going}
            </p>
            {people.length > 0 ? (
              <>
                <div className="mt-1.5">
                  <AvatarStack>
                    {faces.map((person) => (
                      <ParticipantAvatar key={person.id} participant={person} large />
                    ))}
                  </AvatarStack>
                </div>
                <p className="mt-1 truncate text-xs text-[#666b73]">
                  {t.names(
                    people.slice(0, 2).map((p) => p.name),
                    people.length - 2
                  )}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-[#666b73]">{t.nobody}</p>
            )}
          </div>
        </div>

        {event.publishedAt && (
          <p className="mt-4 text-sm font-semibold text-[#2f6b3a]">{t.placePicked}</p>
        )}
        <p className="mt-4 text-[15px] leading-relaxed text-[#666b73]">
          {canJoin ? t.pitch : t.closed}
        </p>

        {canJoin ? (
          <>
            <button
              onClick={() => close('join')}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-[14px] bg-[#c83f49] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[#b73540] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b73540]"
            >
              {t.join}
            </button>
            <button
              onClick={() => close('look')}
              className="mt-3 w-full text-center text-sm font-semibold text-[#8b9098] hover:text-[#21252b]"
            >
              {t.look}
            </button>
          </>
        ) : (
          <button
            onClick={() => close('look')}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-[14px] bg-[#eef1f4] px-5 text-[15px] font-semibold hover:bg-[#e4e8ed]"
          >
            {t.see}
          </button>
        )}
      </div>
    </div>
  );
}
