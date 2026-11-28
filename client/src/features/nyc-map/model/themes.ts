import { readPlanSeed } from '@/features/landing/model/plan-seed';

export const NYC_PATH = '/nyc';

/** Every icon a theme can name as its pin or header art. `ui/icons.tsx` draws each one. */
export const ICON_NAMES = [
  'duck',
  'cup',
  'notebook',
  'umbrella',
  'rain',
  'laptop',
  'pizza',
] as const;
export type IconName = (typeof ICON_NAMES)[number];

export type ThemeFont = 'sans' | 'rounded' | 'hand' | 'serif';
const FONTS: readonly ThemeFont[] = ['sans', 'rounded', 'hand', 'serif'];

/** Map colors feed the Google Maps style; page colors paint the header, pins and card. */
export interface Palette {
  land: string;
  built: string;
  water: string;
  park: string;
  road: string;
  label: string;
  ink: string;
  muted: string;
  soft: string;
  accent: string;
  accentInk: string;
  pin: string;
  pinDetail: string;
  /** The tile on /nyc. */
  tile: string;
  tileInk: string;
}
const PALETTE_KEYS: readonly (keyof Palette)[] = [
  'land',
  'built',
  'water',
  'park',
  'road',
  'label',
  'ink',
  'muted',
  'soft',
  'accent',
  'accentInk',
  'pin',
  'pinDetail',
  'tile',
  'tileInk',
];

/** A texture drawn over the tile and, faintly, over the map. */
export type ThemePattern = 'none' | 'grid';
const PATTERNS: readonly ThemePattern[] = ['none', 'grid'];

export interface ThemePlace {
  placeId: string;
  label: string;
  note: string;
  tags: readonly string[];
}

export interface ThemeLink {
  label: string;
  url: string;
}

/** A line under the list with links, such as where to find a warming center. */
export interface ThemeAside {
  text: string;
  links: readonly ThemeLink[];
}

interface ThemeBase {
  slug: string;
  order: number;
  /** The tile's name on /nyc. */
  name: string;
  /** One short line under the name. */
  line: string;
  marker: IconName;
  art: IconName;
}

/** A theme with a map. */
export interface LiveTheme extends ThemeBase {
  status: 'live';
  title: string;
  description: string;
  updatedAt: string;
  font: ThemeFont;
  pattern: ThemePattern;
  palette: Palette;
  aside: ThemeAside | null;
  places: readonly ThemePlace[];
}

/** A tile that says Coming soon until its events exist. */
export interface SoonTheme extends ThemeBase {
  status: 'soon';
}

export type Theme = LiveTheme | SoonTheme;

export type ThemeResult = { ok: true; theme: Theme } | { ok: false; problems: string[] };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX = /^#[0-9a-f]{6}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True when P1's plan link would keep this place ID. */
export function isPlaceId(value: string): boolean {
  return readPlanSeed(new URLSearchParams({ place: value })).placeId === value;
}

/** Checks one theme file's fields and returns the theme or every problem found. */
export function parseTheme(value: unknown): ThemeResult {
  const problems: string[] = [];
  if (!isRecord(value)) return { ok: false, problems: ['the file is not a YAML mapping'] };

  const text = (key: string, max = 300): string => {
    const field = value[key];
    if (typeof field !== 'string' || !field.trim()) {
      problems.push(`${key} must be a non-empty string`);
      return '';
    }
    if (field.length > max) problems.push(`${key} is longer than ${max} characters`);
    return field.trim();
  };
  const icon = (key: string): IconName => {
    const field = value[key];
    if (typeof field === 'string' && (ICON_NAMES as readonly string[]).includes(field)) {
      return field as IconName;
    }
    problems.push(`${key} must be one of ${ICON_NAMES.join(', ')}`);
    return ICON_NAMES[0];
  };

  const slug = text('slug', 40);
  if (slug && !SLUG.test(slug)) problems.push('slug must be lowercase words joined by hyphens');
  const order = value.order;
  if (typeof order !== 'number' || !Number.isInteger(order))
    problems.push('order must be a whole number');
  const base: ThemeBase = {
    slug,
    order: typeof order === 'number' ? order : 0,
    name: text('name', 40),
    line: text('line', 80),
    marker: icon('marker'),
    art: icon('art'),
  };

  if (value.status === 'soon') {
    return problems.length
      ? { ok: false, problems }
      : { ok: true, theme: { ...base, status: 'soon' } };
  }
  if (value.status !== 'live') problems.push('status must be live or soon');

  const title = text('title', 70);
  const description = text('description', 160);
  const updatedAt = text('updated_at', 10);
  if (updatedAt && !ISO_DATE.test(updatedAt)) problems.push('updated_at must be YYYY-MM-DD');
  const font = value.font;
  if (!FONTS.includes(font as ThemeFont)) problems.push(`font must be one of ${FONTS.join(', ')}`);

  const pattern = value.pattern ?? 'none';
  if (!PATTERNS.includes(pattern as ThemePattern))
    problems.push(`pattern must be one of ${PATTERNS.join(', ')}`);
  const palette = readPalette(value.palette, problems);
  const aside = readAside(value.aside, problems);
  const places = readPlaces(value.places, problems);

  if (problems.length) return { ok: false, problems };
  return {
    ok: true,
    theme: {
      ...base,
      status: 'live',
      title,
      description,
      updatedAt,
      font: font as ThemeFont,
      pattern: pattern as ThemePattern,
      palette,
      aside,
      places,
    },
  };
}

function readPalette(value: unknown, problems: string[]): Palette {
  const palette = {} as Palette;
  if (!isRecord(value)) {
    problems.push('palette must be a mapping of colors');
    return palette;
  }
  for (const key of PALETTE_KEYS) {
    const color = value[key];
    if (typeof color === 'string' && HEX.test(color)) palette[key] = color;
    else problems.push(`palette.${key} must be a #rrggbb color`);
  }
  return palette;
}

function readAside(value: unknown, problems: string[]): ThemeAside | null {
  if (value == null) return null;
  if (!isRecord(value) || typeof value.text !== 'string' || !Array.isArray(value.links)) {
    problems.push('aside must have text and links');
    return null;
  }
  const links = value.links.flatMap((link): ThemeLink[] => {
    if (
      isRecord(link) &&
      typeof link.label === 'string' &&
      typeof link.url === 'string' &&
      link.url.startsWith('https://')
    ) {
      return [{ label: link.label, url: link.url }];
    }
    problems.push('each aside link needs a label and an https url');
    return [];
  });
  return { text: value.text.trim(), links };
}

function readPlaces(value: unknown, problems: string[]): ThemePlace[] {
  if (!Array.isArray(value)) {
    problems.push('places must be a list');
    return [];
  }
  const seen = new Set<string>();
  return value.flatMap((place, index): ThemePlace[] => {
    const where = `places[${index}]`;
    if (!isRecord(place)) {
      problems.push(`${where} must be a mapping`);
      return [];
    }
    const { place_id: placeId, label, note, tags = [] } = place;
    const before = problems.length;
    if (typeof placeId !== 'string' || !isPlaceId(placeId)) {
      problems.push(`${where}.place_id is not a Google place ID`);
    } else if (seen.has(placeId)) {
      problems.push(`${where}.place_id ${placeId} appears twice`);
    } else {
      seen.add(placeId);
    }
    if (typeof label !== 'string' || !label.trim() || label.length > 100) {
      problems.push(`${where}.label must be 1 to 100 characters`);
    }
    if (typeof note !== 'string' || !note.trim() || note.length > 280) {
      problems.push(`${where}.note must be 1 to 280 characters`);
    }
    if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === 'string')) {
      problems.push(`${where}.tags must be a list of words`);
    }
    if (problems.length > before) return [];
    return [
      {
        placeId: placeId as string,
        label: (label as string).trim(),
        note: (note as string).trim(),
        tags: tags as string[],
      },
    ];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function themePath(theme: Pick<Theme, 'slug'>): string {
  return `${NYC_PATH}/${theme.slug}`;
}

/** The analytics source a plan link from this theme carries. */
export function themeSource(theme: Pick<Theme, 'slug'>): string {
  return `nyc-${theme.slug}`;
}

/** Google Maps' own link for a place, with no API call. */
export function mapsUrl(place: Pick<ThemePlace, 'label' | 'placeId'>): string {
  const params = new URLSearchParams({
    api: '1',
    query: place.label,
    query_place_id: place.placeId,
  });
  return `https://www.google.com/maps/search/?${params}`;
}

export function directionsUrl(place: Pick<ThemePlace, 'label' | 'placeId'>): string {
  const params = new URLSearchParams({
    api: '1',
    destination: place.label,
    destination_place_id: place.placeId,
  });
  return `https://www.google.com/maps/dir/?${params}`;
}
