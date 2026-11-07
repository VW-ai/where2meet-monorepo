import { Coffee, MapPin, Utensils, Wine, type IconNode } from 'lucide';
import { getVenueCategory, type Event, type Venue, type VenueCategory } from '@/entities';
import { getMutedHexColor } from '@/features/meeting/lib/participant-colors';
import { LANGUAGE_TAGS, localeFor, type Locale } from '@/shared/lib/locale';

export type PublishedEvent = Event & { publishedAt: string; publishedVenueId: string };

/** Only a published event has a venue to invite people to. */
export function isPublished(event: Event): event is PublishedEvent {
  return Boolean(event.publishedAt && event.publishedVenueId);
}

export type VenueKind = 'coffee' | 'food' | 'drinks' | 'place';

export interface VenueKindInfo {
  icon: IconNode;
  /** On the ticket's tag. */
  label: Record<Locale, string>;
  /** The big word above the ticket. */
  word: Record<Locale, string>;
}

export const VENUE_KINDS: Record<VenueKind, VenueKindInfo> = {
  coffee: { icon: Coffee, label: { en: 'COFFEE', zh: '咖啡' }, word: { en: 'COFFEE', zh: '咖啡' } },
  food: { icon: Utensils, label: { en: 'FOOD', zh: '美食' }, word: { en: 'FOOD', zh: '吃饭' } },
  drinks: { icon: Wine, label: { en: 'DRINKS', zh: '酒吧' }, word: { en: 'DRINKS', zh: '小酌' } },
  place: { icon: MapPin, label: { en: 'PLACE', zh: '地点' }, word: { en: 'MEET UP', zh: '见面' } },
};

const KIND_BY_CATEGORY: Partial<Record<VenueCategory, VenueKind>> = {
  cafe: 'coffee',
  restaurant: 'food',
  bar: 'drinks',
};

/** What the ticket shows once the event is published, in the meeting's locale. */
export interface Invitation {
  locale: Locale;
  title: string;
  host: string | null;
  url: string;
  /** Printed on the ticket's strip, like `W2M-A8K3-MX2P`. */
  code: string;
  kind: VenueKind;
  /** In the meeting's own time zone, or labelled UTC for an event saved without one; null without a time. */
  when: { startsAt: string; date: string; time: string } | null;
  venue: { name: string; address: string; photoUrl: string | null } | null;
  going: { initial: string; color: string }[];
  /** The publish moment as the ticket's foot prints it. */
  issued: string;
}

export function invitationFor(
  event: PublishedEvent,
  venue: Venue | null,
  origin: string
): Invitation {
  const locale = localeFor(event.mapProvider);
  const zone = event.meetingTimeZone ?? 'UTC';
  return {
    locale,
    title: event.title,
    host: event.participants.find((p) => p.isOrganizer)?.name ?? null,
    url: `${origin}/meet/${event.id}`,
    code: invitationCode(event.id),
    kind: (venue && KIND_BY_CATEGORY[getVenueCategory(venue.types)]) ?? 'place',
    when: event.meetingTime
      ? { startsAt: event.meetingTime, ...dateAndTime(event.meetingTime, zone, locale) }
      : null,
    venue: venue && { name: venue.name, address: venue.address, photoUrl: venue.photoUrl },
    going: event.participants.map((p) => ({
      initial: Array.from(p.name.trim())[0]?.toUpperCase() ?? '?',
      color: getMutedHexColor(p.color),
    })),
    issued: stamp(event.publishedAt, zone, locale),
  };
}

/** `evt_1702000000000_a8K3mX2pQrS7nBvW` → `W2M-A8K3-MX2P`: the id's random part, in fours. */
export function invitationCode(eventId: string): string {
  const random = (eventId.split('_').at(-1) ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  return ['W2M', ...(random.slice(0, 8).match(/.{1,4}/g) ?? [])].join('-');
}

type Parts = Partial<Record<Intl.DateTimeFormatPartTypes, string>>;

function parts(iso: string, timeZone: string, locale: Locale, options: Intl.DateTimeFormatOptions) {
  const formatted = new Intl.DateTimeFormat(LANGUAGE_TAGS[locale], { ...options, timeZone });
  return Object.fromEntries(
    formatted.formatToParts(new Date(iso)).map((part) => [part.type, part.value])
  ) as Parts;
}

/**
 * en `Sat, Oct 17` + `11:00 AM EDT`; zh `10月17日` + `周六 23:00 GMT+8`, since Chinese
 * glyphs are too wide for the weekday to fit on the date line.
 */
function dateAndTime(iso: string, timeZone: string, locale: Locale) {
  const p = parts(iso, timeZone, locale, {
    weekday: 'short',
    month: locale === 'zh' ? 'numeric' : 'short',
    day: 'numeric',
    hour: locale === 'zh' ? '2-digit' : 'numeric',
    minute: '2-digit',
    hourCycle: locale === 'zh' ? 'h23' : 'h12',
    timeZoneName: 'short',
  });
  return locale === 'zh'
    ? {
        date: `${p.month}月${p.day}日`,
        time: `${p.weekday} ${p.hour}:${p.minute} ${p.timeZoneName}`,
      }
    : {
        date: `${p.weekday}, ${p.month} ${p.day}`,
        time: `${p.hour}:${p.minute} ${p.dayPeriod} ${p.timeZoneName}`,
      };
}

/** en `10.14.26 8:00 AM`; zh `2026.10.14 20:00`. */
function stamp(iso: string, timeZone: string, locale: Locale): string {
  const p = parts(iso, timeZone, locale, {
    year: locale === 'zh' ? 'numeric' : '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: locale === 'zh' ? '2-digit' : 'numeric',
    minute: '2-digit',
    hourCycle: locale === 'zh' ? 'h23' : 'h12',
  });
  return locale === 'zh'
    ? `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}`
    : `${p.month}.${p.day}.${p.year} ${p.hour}:${p.minute} ${p.dayPeriod}`;
}

const INVITED: Record<Locale, string> = { en: "You're invited: ", zh: '邀请你来：' };

export function shareText({ locale, title, when, venue }: Invitation): string {
  return [
    `${INVITED[locale]}${title}`,
    when && `${when.date}, ${when.time}`,
    venue && `${venue.name}, ${venue.address}`,
  ]
    .filter(Boolean)
    .join(' · ');
}
