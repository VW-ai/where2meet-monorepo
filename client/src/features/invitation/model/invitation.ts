import tzLookup from 'tz-lookup';
import type { Event, Venue } from '@/entities';

/** What the host sends everyone once the event is published: the card's text and its link. */
export interface Invitation {
  title: string;
  /** Spelled out in the meeting place's time zone, or null when no time is set. */
  when: string | null;
  host: string | null;
  venue: { name: string; address: string; photoUrl: string | null } | null;
  url: string;
}

export function invitationFor(event: Event, venue: Venue | null, origin: string): Invitation {
  return {
    title: event.title,
    when: event.meetingTime ? formatWhen(event.meetingTime, timeZoneFor(event, venue)) : null,
    host: event.participants.find((p) => p.isOrganizer)?.name ?? null,
    venue: venue && { name: venue.name, address: venue.address, photoUrl: venue.photoUrl },
    url: `${origin}/meet/${event.id}`,
  };
}

/** `Saturday, October 17 at 11:00 AM EDT` for an ISO instant read in `timeZone`. */
export function formatWhen(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone,
  }).format(new Date(iso));
}

/** The meeting place sets the clock, not the reader's browser. */
export function timeZoneFor(event: Event, venue: Venue | null): string {
  const place = venue?.location ?? event.mec?.center;
  return place ? tzLookup(place.lat, place.lng) : 'UTC';
}

export function shareText({ title, when, venue }: Invitation): string {
  return [`You're invited: ${title}`, when, venue && `${venue.name}, ${venue.address}`]
    .filter(Boolean)
    .join(' · ');
}
