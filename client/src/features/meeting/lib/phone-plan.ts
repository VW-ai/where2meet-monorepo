import type { Locale } from '@/shared/lib/i18n';
import type { Location } from '@/shared/types/map';

export type PlaceCategory = 'all' | 'coffee' | 'food' | 'drinks';
export type PlanKind = 'coffee' | 'drinks' | 'food' | 'meetup';

export const CATEGORY_QUERY: Record<PlaceCategory, string> = {
  all: 'places to meet',
  coffee: 'cafe',
  food: 'restaurant',
  drinks: 'bar',
};

const KIND_RULES: ReadonlyArray<readonly [RegExp, PlanKind]> = [
  [/coffee|latte|caf[eé]|\btea\b|matcha|咖啡|奶茶/i, 'coffee'],
  [/drink|\bbars?\b|beer|wine|cocktail|happy hour|\bpub\b|喝酒|酒吧/i, 'drinks'],
  [
    /dinner|lunch|brunch|breakfast|food|\beat\b|hot ?pot|ramen|sushi|pizza|bbq|taco|吃|饭|火锅/i,
    'food',
  ],
];

/** Read from the event name, so there is nothing for the organizer to choose. */
export function planKind(name: string): PlanKind {
  return KIND_RULES.find(([rule]) => rule.test(name))?.[1] ?? 'meetup';
}

export function categoryOfKind(kind: PlanKind): PlaceCategory {
  return kind === 'meetup' ? 'all' : kind;
}

export const PLAN_KIND_LABEL: Record<Locale, Record<PlanKind, string>> = {
  en: { coffee: 'COFFEE', drinks: 'DRINKS', food: 'FOOD', meetup: 'MEETUP' },
  zh: { coffee: '咖啡', drinks: '小酌', food: '吃饭', meetup: '见面' },
};

export const TIME_SLOTS: ReadonlyArray<readonly [hour: number, minute: number]> = [
  [11, 0],
  [13, 0],
  [15, 0],
  [18, 0],
  [19, 30],
];

export function defaultMeetingDate(now: Date): Date {
  const tonight = new Date(now);
  tonight.setHours(19, 30, 0, 0);
  if (tonight > now) return tonight;
  tonight.setDate(tonight.getDate() + 1);
  return tonight;
}

export function pickerDays(now: Date): Date[] {
  return Array.from({ length: 14 }, (_, offset) => {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + offset);
    return day;
  });
}

export function onDay(date: Date, day: Date): Date {
  const next = new Date(day);
  next.setHours(date.getHours(), date.getMinutes(), 0, 0);
  return next;
}

export function atTime(date: Date, hour: number, minute: number): Date {
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

/** A time already gone moves to the next half hour, so today never starts in the past. */
export function upcoming(date: Date, now: Date): Date {
  if (date > now) return date;
  const next = new Date(now);
  next.setMinutes(next.getMinutes() + (30 - (next.getMinutes() % 30)), 0, 0);
  return next;
}

const LANGUAGE: Record<Locale, string> = { en: 'en-US', zh: 'zh-CN' };

function format(date: Date, locale: Locale, options: Intl.DateTimeFormatOptions, zone?: string) {
  return new Intl.DateTimeFormat(LANGUAGE[locale], { ...options, timeZone: zone }).format(date);
}

export const whenText = {
  stamp: (date: Date, locale: Locale, zone?: string) =>
    format(date, locale, { month: 'short', day: 'numeric' }, zone).toUpperCase(),
  time: (date: Date, locale: Locale, zone?: string) =>
    format(date, locale, { hour: 'numeric', minute: '2-digit' }, zone),
  weekday: (date: Date, locale: Locale) => format(date, locale, { weekday: 'short' }),
  dayNumber: (date: Date, locale: Locale) =>
    format(date, locale, { day: 'numeric' }).replace('日', ''),
  issued: (date: Date, locale: Locale) =>
    format(date, locale, { month: 'short', day: '2-digit' }).toUpperCase(),
};

function relativeDay(date: Date, now: Date, locale: Locale): string | null {
  if (isSameDay(date, now)) return locale === 'zh' ? '今天' : 'Today';
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isSameDay(date, tomorrow) ? (locale === 'zh' ? '明天' : 'Tomorrow') : null;
}

/** "Tomorrow · 7:30 PM" or "Fri, Nov 6 · 7:30 PM" */
export function whenLine(date: Date, now: Date, locale: Locale): string {
  const day =
    relativeDay(date, now, locale) ??
    format(date, locale, { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} · ${whenText.time(date, locale)}`;
}

/** "Fri 7:30 PM", or "Nov 20 7:30 PM" once it is more than a week out. */
export function whenShort(date: Date, now: Date, locale: Locale): string {
  const week = new Date(now);
  week.setDate(week.getDate() + 7);
  const day =
    relativeDay(date, now, locale) ??
    (date < week
      ? format(date, locale, { weekday: 'short' })
      : format(date, locale, { month: 'short', day: 'numeric' }));
  return `${day} ${whenText.time(date, locale)}`;
}

const SEARCH_STEP = 250;
const SEARCH_MIN = 500;
const SEARCH_MAX = 5000;

function distanceMeters(a: Location, b: Location): number {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** The first search area: around everyone, in the steps the radius handle snaps to. */
export function fitSearchArea(
  points: readonly Location[]
): { center: Location; radius: number } | null {
  if (points.length === 0) return null;
  const center = {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
  };
  const reach = Math.max(...points.map((point) => distanceMeters(center, point)));
  const wanted = Math.round(Math.max(1000, reach * 0.75) / SEARCH_STEP) * SEARCH_STEP;
  return { center, radius: Math.min(SEARCH_MAX, Math.max(SEARCH_MIN, wanted)) };
}

/** Web Mercator at 256px tiles: the map point `dx`, `dy` pixels off `center` on screen. */
export function offsetPoint(center: Location, zoom: number, dx: number, dy: number): Location {
  const scale = 256 * 2 ** zoom;
  const sin = Math.sin((center.lat * Math.PI) / 180);
  const worldY = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale + dy;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * worldY) / scale))) * 180) / Math.PI;
  return { lat, lng: center.lng + (dx / scale) * 360 };
}

const IDEAS = ['HOT POT', 'BOOK CLUB', 'BIRTHDAY', 'KARAOKE', 'GAME NIGHT', 'BRUNCH'];
const IDEAS_ZH = ['火锅', '读书会', '生日', 'K 歌', '游戏夜', '早午餐'];

export interface Ticker {
  index: number;
  count: number;
  deleting: boolean;
}

/** One keystroke of the example names on the empty create screen, with how long to hold the result. */
export function stepTicker(ticker: Ticker, locale: Locale): { next: Ticker; holdMs: number } {
  const words = locale === 'zh' ? IDEAS_ZH : IDEAS;
  const length = [...words[ticker.index % words.length]].length;
  if (!ticker.deleting && ticker.count >= length) {
    return { next: { ...ticker, deleting: true }, holdMs: 1500 };
  }
  if (ticker.deleting && ticker.count <= 0) {
    return { next: { index: ticker.index + 1, count: 0, deleting: false }, holdMs: 260 };
  }
  const delta = ticker.deleting ? -1 : 1;
  return {
    next: { ...ticker, count: ticker.count + delta },
    holdMs: ticker.deleting ? 36 : 85,
  };
}

export function tickerText(ticker: Ticker, locale: Locale): string {
  const words = locale === 'zh' ? IDEAS_ZH : IDEAS;
  return [...words[ticker.index % words.length]].slice(0, ticker.count).join('');
}

/** The first size whose longest word fits the box in at most two lines. Anton is about .46em wide. */
const ANTON_LINE_HEIGHT = 1.505;

function wrappedLines(words: string[], width: number, measure: (text: string) => number) {
  let lines = 1;
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > width) {
      lines += 1;
      line = word;
    } else {
      line = next;
    }
  }
  return lines;
}

/** The largest size at which the words fit the box in two lines, wrapping only at spaces. */
export function fittedWordSize(
  text: string,
  sizes: readonly number[],
  box: { width: number; height: number },
  measure: (text: string, size: number) => number
): number {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  const fits = (size: number) => {
    const widthAt = (value: string) => measure(value, size);
    if (Math.max(0, ...words.map(widthAt)) > box.width) return false;
    const lines = wrappedLines(words, box.width, widthAt);
    return lines <= 2 && lines * size * ANTON_LINE_HEIGHT <= box.height;
  };
  return sizes.find(fits) ?? sizes[sizes.length - 1];
}

export const AVATAR_TINTS: Record<string, string> = {
  coral: '#E5604D',
  teal: '#0F8F8C',
  gold: '#C99A06',
  orchid: '#B658B2',
  lime: '#5BA61C',
  dodgerblue: '#2F7BF6',
  tomato: '#E2553D',
  mediumseagreen: '#2E9E6B',
  slateblue: '#6A5ACD',
  darkorange: '#E0812B',
  hotpink: '#D6457A',
  steelblue: '#4682B4',
  yellowgreen: '#7FA62C',
  mediumpurple: '#8E6BD8',
  indianred: '#C2504F',
  cadetblue: '#4A8F92',
};

export function avatarTint(color: string | undefined): string {
  return (color && AVATAR_TINTS[color]) || '#5F636B';
}

export function initials(name: string): string {
  return [...name.trim()].slice(0, 2).join('');
}
