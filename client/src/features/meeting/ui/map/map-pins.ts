import {
  BookOpen,
  Coffee,
  Compass,
  Crown,
  Dumbbell,
  Landmark,
  ShoppingBag,
  Trees,
  Utensils,
  Wine,
  type IconNode,
} from 'lucide';
import { getVenueCategory, type Venue, type VenueCategory } from '@/entities/venue/types';
import { getHexColor } from '@/features/meeting/lib/participant-colors';
import type { Locale } from '@/shared/lib/i18n';

const INK = '#21252b';
const INK_2 = '#5f636b';
const RED = '#bc3942';
const WHITE = '#ffffff';
const FONT = "-apple-system, 'Segoe UI', 'PingFang SC', sans-serif";

export type VenuePinEmphasis = 'plain' | 'hovered' | 'liked' | 'selected' | 'published';

export interface VenuePinLook {
  category: VenueCategory;
  likes: number;
  emphasis: VenuePinEmphasis;
  name?: string;
}

export interface PersonPinLook {
  label: string;
  color: string;
  tripLabel?: string;
  selected: boolean;
  draft?: boolean;
}

/** Sizes are CSS pixels and the anchor is the map location. `hit` is what takes clicks, so a label never blocks a pan. */
export interface PinImage {
  url: string;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  hit: { x: number; y: number; radius: number };
}

const NAME_MAX_CHARACTERS = 24;

export function truncatePinName(name: string): string {
  const characters = Array.from(name.trim());
  if (characters.length <= NAME_MAX_CHARACTERS) return characters.join('');
  return `${characters
    .slice(0, NAME_MAX_CHARACTERS - 1)
    .join('')
    .trimEnd()}…`;
}

export function venuePinLook(
  venue: Pick<Venue, 'types' | 'name'>,
  state: {
    likes: number;
    isSaved: boolean;
    isSelected: boolean;
    isHovered: boolean;
    isPublished: boolean;
  }
): VenuePinLook {
  const { likes, isSaved, isSelected, isHovered, isPublished } = state;
  const emphasis: VenuePinEmphasis = isPublished
    ? 'published'
    : isSelected
      ? 'selected'
      : isHovered
        ? 'hovered'
        : likes > 0 || isSaved
          ? 'liked'
          : 'plain';
  const look: VenuePinLook = { category: getVenueCategory(venue.types), likes, emphasis };
  return emphasis === 'plain' || emphasis === 'liked'
    ? look
    : { ...look, name: truncatePinName(venue.name) };
}

/** `8m`, `1h 24m`; zh `8分`, `1时24分`. Never rounds a real trip down to zero. */
export function tripLabel(seconds: number, locale: Locale): string {
  const total = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (locale === 'zh') {
    if (hours === 0) return `${minutes}分`;
    return minutes === 0 ? `${hours}时` : `${hours}时${minutes}分`;
  }
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

export function personPinLabel(name: string, isSelf: boolean, locale: Locale): string {
  if (isSelf) return locale === 'zh' ? '我' : 'You';
  return Array.from(name.trim()).slice(0, 2).join('').trim();
}

export function personPinLook(
  person: { name: string; color: string | undefined },
  state: {
    isSelf: boolean;
    isSelected: boolean;
    isDraft?: boolean;
    tripSeconds?: number;
    locale: Locale;
  }
): PersonPinLook {
  const { isSelf, isSelected, isDraft, tripSeconds, locale } = state;
  return {
    label: personPinLabel(person.name, isSelf, locale),
    color: getHexColor(person.color),
    selected: isSelected,
    ...(tripSeconds === undefined ? {} : { tripLabel: tripLabel(tripSeconds, locale) }),
    ...(isDraft ? { draft: true } : {}),
  };
}

/** Everyone's map layers in one place: plain, liked, hovered, people, then the venue being looked at. */
export function venuePinZIndex({ emphasis }: VenuePinLook): number {
  return { plain: 5, liked: 30, hovered: 40, selected: 80, published: 85 }[emphasis];
}

export function personPinZIndex({ selected, draft }: PersonPinLook): number {
  if (draft) return 90;
  return selected ? 65 : 60;
}

/** Search results, plus what stays on the map through any search: liked, published and selected. */
export function venuesOnMap({
  searched,
  venueById,
  likedIds,
  selected,
  publishedId,
}: {
  searched: readonly Venue[];
  venueById: Readonly<Record<string, Venue>>;
  likedIds: readonly string[];
  selected: Venue | null;
  publishedId: string | null | undefined;
}): Venue[] {
  const venues = new Map(searched.map((venue) => [venue.id, venue]));
  likedIds.forEach((id) => {
    const venue = venueById[id];
    if (venue) venues.set(id, venue);
  });
  const published = publishedId ? venueById[publishedId] : undefined;
  if (published && !venues.has(published.id)) venues.set(published.id, published);
  if (selected && !venues.has(selected.id)) venues.set(selected.id, selected);
  // A venue from an incomplete stream can arrive without a location
  return [...venues.values()].filter(
    ({ location }) => location && location.lat != null && location.lng != null
  );
}

/** Clockwise from north, in the order the prototype tries them: over the top first, then around. */
const HANDLE_BEARINGS = [0, 30, -30, 60, -60, 90, -90, 120, -120];

/** Where the two search area handles sit, avoiding whatever covers the map. Null when nowhere is free. */
export function searchHandleBearings(isFree: (bearing: number) => boolean): {
  move: number | null;
  size: number | null;
} {
  const free = HANDLE_BEARINGS.filter(isFree);
  return { move: free[0] ?? null, size: free[1] ?? null };
}

const CATEGORY_ICONS: Record<VenueCategory, IconNode> = {
  cafe: Coffee,
  restaurant: Utensils,
  bar: Wine,
  gym: Dumbbell,
  park: Trees,
  museum: Landmark,
  library: BookOpen,
  shopping: ShoppingBag,
  things_to_do: Compass,
};

const VENUE_DOT_DIAMETER: Record<VenuePinEmphasis, number> = {
  plain: 30,
  hovered: 34,
  liked: 36,
  selected: 43,
  published: 48,
};
const LIKED_HOVERED_DOT_DIAMETER = 40;
const PERSON_RADIUS = 20;
const SELECTED_PERSON_RADIUS = 23;
const SHADOW_ROOM = 10;

function isXmlCharacter(character: string): boolean {
  const code = character.codePointAt(0)!;
  if (code < 0x20) return code === 0x9 || code === 0xa || code === 0xd;
  return !(code >= 0xd800 && code <= 0xdfff) && code !== 0xfffe && code !== 0xffff;
}

const XML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** A place name comes from outside, and one bad character would break the whole image. */
function escapeXml(text: string): string {
  return Array.from(text)
    .filter(isXmlCharacter)
    .join('')
    .replace(/[&<>"']/g, (character) => XML_ENTITIES[character]);
}

/** Errs wide, because a label wider than its estimate gets clipped. The page's fonts don't reach a data URL. */
function estimateTextWidth(text: string, fontSize: number): number {
  return Array.from(text).reduce((width, character) => {
    const code = character.codePointAt(0)!;
    if (code > 0x2e7f) return width + fontSize * 1.08;
    return width + fontSize * (/[A-Z@%&MWmw]/.test(character) ? 0.8 : 0.6);
  }, 0);
}

function shadowFilter(dy: number, blur: number, opacity: number): string {
  return `<defs><filter id="shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="${dy}" stdDeviation="${blur / 2}" flood-color="#000000" flood-opacity="${opacity}"/></filter></defs>`;
}

function textElement(
  text: string,
  {
    x,
    y,
    size,
    fill,
    extra = '',
  }: { x: number; y: number; size: number; fill: string; extra?: string }
): string {
  return `<text x="${x}" y="${y}" text-anchor="middle" fill="${fill}" font-family="${FONT}" font-size="${size}" font-weight="700"${extra}>${escapeXml(text)}</text>`;
}

function iconElement(icon: IconNode, cx: number, cy: number, size: number, color: string): string {
  const shapes = icon
    .map(([tag, attrs]) => {
      const attributes = Object.entries(attrs)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');
      return `<${tag} ${attributes}/>`;
    })
    .join('');
  return `<g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${size / 24})" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${shapes}</g>`;
}

/** Drawn at twice its display size, so the image stays sharp however the map rasterizes it. */
function toPinImage(
  width: number,
  height: number,
  anchorX: number,
  anchorY: number,
  hit: PinImage['hit'],
  body: string
): PinImage {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 2}" height="${height * 2}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
  return {
    url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    width,
    height,
    anchorX,
    anchorY,
    hit,
  };
}

function drawVenuePin(look: VenuePinLook): PinImage {
  const { category, likes, emphasis, name } = look;
  const hoveredLiked = emphasis === 'hovered' && likes > 0;
  const filled = hoveredLiked || (emphasis !== 'plain' && emphasis !== 'hovered');
  const diameter = hoveredLiked ? LIKED_HOVERED_DOT_DIAMETER : VENUE_DOT_DIAMETER[emphasis];
  const radius = diameter / 2;
  const count = likes > 0 ? String(likes) : null;
  const badgeWidth = count ? Math.max(18, count.length * 6.6 + 8) : 0;
  const badgeOffset = radius * 0.72;
  const nameWidth = name ? estimateTextWidth(name, 12) + 8 : 0;

  const halfWidth = Math.ceil(
    Math.max(radius + SHADOW_ROOM, badgeOffset + badgeWidth / 2 + 2, nameWidth / 2 + 2)
  );
  const cx = halfWidth;
  const cy = Math.ceil(radius) + SHADOW_ROOM;
  const nameBaseline = cy + radius + 15;
  const height = Math.ceil(name ? nameBaseline + 5 : cy + radius + SHADOW_ROOM);

  const parts = [
    shadowFilter(2, 7, 0.25),
    `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${filled ? RED : WHITE}" filter="url(#shadow)"/>`,
    iconElement(
      emphasis === 'published' ? Crown : CATEGORY_ICONS[category],
      cx,
      cy,
      (diameter * 16) / 30,
      filled ? WHITE : INK_2
    ),
  ];
  if (count) {
    const badgeX = cx + badgeOffset;
    const badgeY = cy - badgeOffset;
    parts.push(
      `<rect x="${badgeX - badgeWidth / 2 + 0.75}" y="${badgeY - 8.25}" width="${badgeWidth - 1.5}" height="16.5" rx="8.25" fill="${RED}" stroke="${WHITE}" stroke-width="1.5"/>`,
      textElement(count, { x: badgeX, y: badgeY + 4, size: 11, fill: WHITE })
    );
  }
  if (name) {
    parts.push(
      textElement(name, {
        x: cx,
        y: nameBaseline,
        size: 12,
        fill: INK,
        extra: ` stroke="${WHITE}" stroke-width="3" stroke-linejoin="round" paint-order="stroke"`,
      })
    );
  }
  return toPinImage(
    halfWidth * 2,
    height,
    cx,
    cy,
    { x: cx, y: cy, radius: Math.ceil(radius) },
    parts.join('')
  );
}

function drawPersonPin(look: PersonPinLook, spin: boolean): PinImage {
  const { label, color, tripLabel: trip, selected, draft } = look;
  const radius = selected ? SELECTED_PERSON_RADIUS : PERSON_RADIUS;
  const chipWidth = trip ? Math.ceil(estimateTextWidth(trip, 11) + 12) : 0;
  const chipHeight = 18;
  const chipTop = 2;
  const halfWidth = Math.ceil(Math.max(radius + 14, chipWidth / 2 + 2));
  const cx = halfWidth;
  const cy = chipTop + chipHeight - 8 + radius;
  const tailTop = cy + radius - 1;
  const tipY = tailTop + 9;
  const fill = escapeXml(color);

  const parts = [
    shadowFilter(3, 10, 0.28),
    `<g filter="url(#shadow)"><path d="M${cx - 6} ${tailTop} L${cx + 6} ${tailTop} L${cx} ${tipY} Z" fill="${WHITE}"/><circle cx="${cx}" cy="${cy}" r="${radius - 1.5}" fill="${fill}" stroke="${WHITE}" stroke-width="3"/></g>`,
    textElement(label, { x: cx, y: cy + 4.5, size: 13, fill: WHITE }),
  ];
  if (draft) {
    // SMIL only keeps running in an image if the marker is drawn with `optimized: false`
    const spinner = spin
      ? `<animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="5s" repeatCount="indefinite"/>`
      : '';
    parts.unshift(
      `<circle cx="${cx}" cy="${cy}" r="${radius + 5}" fill="none" stroke="${fill}" stroke-width="2" stroke-dasharray="4 4">${spinner}</circle>`
    );
  }
  if (trip) {
    parts.push(
      `<rect x="${cx - chipWidth / 2}" y="${chipTop}" width="${chipWidth}" height="${chipHeight}" rx="9" fill="${INK}"/>`,
      textElement(trip, { x: cx, y: chipTop + 13, size: 11, fill: WHITE })
    );
  }
  return toPinImage(
    halfWidth * 2,
    tipY + SHADOW_ROOM,
    cx,
    tipY,
    { x: cx, y: cy, radius },
    parts.join('')
  );
}

const drawn = new Map<string, PinImage>();

/** The same look gives the same object, which is how the map knows a marker needs no new icon. */
function cached(key: string, draw: () => PinImage): PinImage {
  let image = drawn.get(key);
  if (!image) {
    image = draw();
    drawn.set(key, image);
  }
  return image;
}

export function venuePinImage(look: VenuePinLook): PinImage {
  return cached(`venue:${JSON.stringify(look)}`, () => drawVenuePin(look));
}

export function personPinImage(look: PersonPinLook, spin = false): PinImage {
  return cached(`person:${spin}:${JSON.stringify(look)}`, () => drawPersonPin(look, spin));
}

const HANDLE_BOX = 48;

function drawSearchHandle(diameter: number, inner: string): PinImage {
  const center = HANDLE_BOX / 2;
  return toPinImage(
    HANDLE_BOX,
    HANDLE_BOX,
    center,
    center,
    { x: center, y: center, radius: center },
    `${shadowFilter(2, 8, 0.25)}<circle cx="${center}" cy="${center}" r="${diameter / 2 - 1}" fill="${WHITE}" stroke="${RED}" stroke-width="2" filter="url(#shadow)"/>${inner}`
  );
}

const MOVE_ARROWS: IconNode = [
  [
    'path',
    {
      d: 'M12 2v20M2 12h20M12 2 9 5M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3',
    },
  ],
];

export const SEARCH_MOVE_HANDLE = drawSearchHandle(
  30,
  iconElement(MOVE_ARROWS, HANDLE_BOX / 2, HANDLE_BOX / 2, 16, RED)
);
export const SEARCH_SIZE_HANDLE = drawSearchHandle(22, '');

export const SEARCH_AREA_RED = RED;
