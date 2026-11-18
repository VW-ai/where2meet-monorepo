'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Plus } from 'lucide-react';
import { useAuthStore } from '@/features/auth/model/auth-store';
import type { UserEventResponse } from '@/features/auth/types';
import { AccountShell, accountStyles as s } from '@/features/auth/ui/account-shell';
import { UserMenu } from '@/features/auth/ui/user-menu';
import { EventCard } from '@/features/dashboard/ui/event-card';
import { ClaimEventsBanner } from '@/features/dashboard/ui/claim-events-banner';
import { groupMeetings } from '@/features/dashboard/lib/group-meetings';
import { loadMeetings } from '@/features/dashboard/lib/meetings-request';
import catLogo from '@/components/cat/logo.svg';

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; userEvents: UserEventResponse[] };

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-[1.5px] text-[#8b9098]">
      {title} <span className="text-[#a3a8b0]">· {count}</span>
    </h2>
  );
}

function MeetingGrid({
  userEvents,
  isPast,
}: {
  userEvents: UserEventResponse[];
  isPast?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {userEvents.map((userEvent) => (
        <EventCard key={userEvent.event.id} userEvent={userEvent} isPast={isPast} />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const loadEvents = useCallback(async () => {
    try {
      setState({ status: 'ready', userEvents: await loadMeetings() });
    } catch (error) {
      console.error('Error loading events:', error);
      setState({ status: 'error' });
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const firstName = user?.name?.trim().split(/\s+/)[0];

  return (
    <AccountShell width="wide" actions={<UserMenu />}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.8px]">Your meetings</h1>
          <p className="mt-1 text-[15px] text-[#666b73]">
            {firstName ? `Hi ${firstName}. ` : ''}Everything you&apos;ve planned or joined.
          </p>
        </div>
        <Link href="/" className={s.primaryButton}>
          <Plus size={18} strokeWidth={2.5} />
          New meeting
        </Link>
      </div>

      <ClaimEventsBanner onClaimed={loadEvents} />

      {state.status === 'loading' && (
        <div className="grid gap-4 sm:grid-cols-2" aria-label="Loading meetings">
          {[0, 1].map((i) => (
            <div key={i} className="h-[178px] animate-pulse rounded-[22px] bg-white/70" />
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <div className={`${s.card} text-center`}>
          <p className="text-[15px] font-semibold">We couldn&apos;t load your meetings.</p>
          <button
            onClick={() => {
              setState({ status: 'loading' });
              loadEvents();
            }}
            className={`mt-4 ${s.secondaryButton}`}
          >
            Try again
          </button>
        </div>
      )}

      {state.status === 'ready' && state.userEvents.length === 0 && (
        <div className={`${s.card} flex flex-col items-center py-10 text-center`}>
          <Image src={catLogo} alt="" width={56} height={56} className="h-14 w-14" />
          <p className="mt-4 text-[17px] font-bold">No meetings yet</p>
          <p className="mt-1 max-w-xs text-sm text-[#666b73]">
            Plan one and share the link. Meetings you create or join show up here.
          </p>
          <Link href="/" className={`mt-5 ${s.primaryButton}`}>
            Plan a meeting
          </Link>
        </div>
      )}

      {state.status === 'ready' && state.userEvents.length > 0 && (
        <MeetingSections userEvents={state.userEvents} />
      )}
    </AccountShell>
  );
}

function MeetingSections({ userEvents }: { userEvents: UserEventResponse[] }) {
  const { upcoming, past } = groupMeetings(userEvents, Date.now());
  return (
    <div className="space-y-8">
      {upcoming.length > 0 && (
        <section>
          <SectionHeading title="Upcoming" count={upcoming.length} />
          <MeetingGrid userEvents={upcoming} />
        </section>
      )}
      {past.length > 0 && (
        <section>
          <SectionHeading title="Past" count={past.length} />
          <MeetingGrid userEvents={past} isPast />
        </section>
      )}
    </div>
  );
}
