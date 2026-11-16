import Link from 'next/link';
import { Check } from 'lucide-react';
import type { UserEventResponse } from '@/features/auth/types';

interface EventCardProps {
  userEvent: UserEventResponse;
  isPast?: boolean;
}

const MAX_FACES = 4;

function formatWhen(meetingTime: string, timeZone: string | null) {
  const options: Intl.DateTimeFormatOptions = { timeZone: timeZone ?? undefined };
  try {
    const date = new Date(meetingTime);
    return {
      day: date.toLocaleDateString('en-US', {
        ...options,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      time: date.toLocaleTimeString('en-US', {
        ...options,
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: timeZone ? 'short' : undefined,
      }),
    };
  } catch {
    return null;
  }
}

const initial = (name: string) => name.trim().charAt(0).toUpperCase() || '?';

export function EventCard({ userEvent, isPast = false }: EventCardProps) {
  const { event, role } = userEvent;
  const when = event.meetingTime ? formatWhen(event.meetingTime, event.meetingTimeZone) : null;
  const faces = event.participants.slice(0, MAX_FACES);
  const extra = event.participantCount - faces.length;

  return (
    <Link
      href={`/meet/${event.id}`}
      className={`group block rounded-[22px] bg-white p-5 shadow-[0_4px_24px_rgba(23,37,45,0.08)] transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(23,37,45,0.14)] ${
        isPast ? 'opacity-75 hover:opacity-100' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            role === 'organizer' ? 'bg-[#fff0ef] text-[#bd3843]' : 'bg-[#eef1f4] text-[#555a62]'
          }`}
        >
          {role === 'organizer' ? 'Organizer' : 'Joined'}
        </span>
        {event.publishedAt && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#e9f6ec] px-2.5 py-1 text-[11px] font-semibold text-[#2f6b3a]">
            <Check size={12} strokeWidth={3} />
            Place picked
          </span>
        )}
      </div>

      <h3 className="mt-3 line-clamp-2 text-[17px] font-bold leading-snug tracking-[-0.3px] text-[#21252b]">
        {event.title}
      </h3>

      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-dashed border-[#e4e8ed] pt-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[1.5px] text-[#8b9098]">
            When
          </p>
          {when ? (
            <>
              <p className="mt-1 text-sm font-semibold text-[#21252b]">{when.day}</p>
              <p className="text-xs text-[#666b73]">{when.time}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-[#8b9098]">No time yet</p>
          )}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[1.5px] text-[#8b9098]">
            Going
          </p>
          <div className="mt-1.5 flex items-center">
            {faces.map((person) => (
              <span
                key={person.id}
                title={person.name}
                style={{ backgroundColor: person.color }}
                className="-ml-1.5 grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold text-white ring-2 ring-white first:ml-0"
              >
                {initial(person.name)}
              </span>
            ))}
            {extra > 0 && (
              <span className="-ml-1.5 grid h-7 min-w-7 place-items-center rounded-full bg-[#eef1f4] px-1.5 text-[11px] font-semibold text-[#555a62] ring-2 ring-white">
                +{extra}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
