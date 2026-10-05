import { OCCASIONS, type Occasion } from '@/content/blog/posts';
import { isIsoDate } from '@/lib/seo/site-pages';
import type { Area, Catalog, City, CuratedPlace, Guide, Seo } from './catalog';

/** Why each dropped item was dropped, as `cities[0].guides[2]: unknown occasion "brunch"`. */
export type Issues = string[];

type Fields = Record<string, unknown>;
type ParseItem<T> = (value: unknown, at: string, issues: Issues) => T | null;

const SLUG = /^[a-z0-9-]+$/;

/**
 * Parses the control plane's published JSON (contract v1). A bad city, town, guide or
 * place is dropped and reported in `issues` so the rest still renders. Throws only
 * when the payload as a whole isn't v1.
 */
export function parsePublished(raw: unknown): { catalog: Catalog; issues: Issues } {
  if (!isFields(raw) || raw.version !== 1 || !Array.isArray(raw.cities)) {
    throw new Error('Published guides are not contract v1 JSON');
  }
  const issues: Issues = [];
  const cities = keepFirst(
    parseList(raw.cities, 'cities', issues, parseCity),
    (city) => city.slug,
    'cities',
    issues
  );
  return { catalog: { cities }, issues };
}

function parseCity(value: unknown, at: string, issues: Issues): City | null {
  const area = parseArea(value, at, issues);
  if (!area || !isFields(value)) return null;
  const towns = keepFirst(
    parseList(value.towns, `${at}.towns`, issues, parseArea),
    (town) => town.slug,
    `${at}.towns`,
    issues
  );
  return { ...area, region: text(value.region), towns };
}

function parseArea(value: unknown, at: string, issues: Issues): Area | null {
  if (!isFields(value)) return drop(at, 'not an object', issues);
  const { slug, name, updated_at: updatedAt } = value;
  if (typeof slug !== 'string' || !SLUG.test(slug)) {
    return drop(at, `invalid slug ${JSON.stringify(slug)}`, issues);
  }
  if (isOccasion(slug)) return drop(at, `slug "${slug}" is an occasion`, issues);
  if (!isText(name)) return drop(at, 'missing name', issues);
  if (typeof updatedAt !== 'string' || !isIsoDate(updatedAt)) {
    return drop(at, 'invalid updated_at', issues);
  }
  const seo = parseSeo(value.seo);
  if (!seo) return drop(at, 'invalid seo', issues);
  const guides = keepFirst(
    parseList(value.guides, `${at}.guides`, issues, parseGuide),
    (guide) => guide.occasion,
    `${at}.guides`,
    issues
  );
  return {
    slug,
    name,
    updatedAt,
    seo,
    intro: text(value.intro),
    transitNotes: text(value.transit_notes),
    guides,
  };
}

function parseGuide(value: unknown, at: string, issues: Issues): Guide | null {
  if (!isFields(value)) return drop(at, 'not an object', issues);
  const { occasion, updated_at: updatedAt } = value;
  if (typeof occasion !== 'string' || !isOccasion(occasion)) {
    return drop(at, `unknown occasion ${JSON.stringify(occasion)}`, issues);
  }
  if (typeof updatedAt !== 'string' || !isIsoDate(updatedAt)) {
    return drop(at, 'invalid updated_at', issues);
  }
  const seo = parseSeo(value.seo);
  if (!seo) return drop(at, 'invalid seo', issues);
  return {
    occasion,
    updatedAt,
    seo,
    intro: text(value.intro),
    tips: text(value.tips),
    places: keepFirst(
      parseList(value.places, `${at}.places`, issues, parsePlace),
      (place) => place.placeId,
      `${at}.places`,
      issues
    ),
  };
}

function parsePlace(value: unknown, at: string, issues: Issues): CuratedPlace | null {
  if (!isFields(value)) return drop(at, 'not an object', issues);
  if (!isText(value.place_id)) return drop(at, 'missing place_id', issues);
  if (!isText(value.label)) return drop(at, 'missing label', issues);
  return { placeId: value.place_id, label: value.label, note: text(value.note) };
}

function parseSeo(value: unknown): Seo | null {
  if (!isFields(value) || !isText(value.title) || !isText(value.description)) return null;
  return { title: value.title, description: value.description };
}

/** A missing list reads as empty. */
function parseList<T>(value: unknown, at: string, issues: Issues, parseItem: ParseItem<T>): T[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => parseItem(item, `${at}[${index}]`, issues) ?? []);
}

/** Slugs are unique within their parent, occasions within their area, places within a guide. */
function keepFirst<T>(items: T[], key: (item: T) => string, at: string, issues: Issues): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) {
      drop(at, `repeats "${value}"`, issues);
      return false;
    }
    seen.add(value);
    return true;
  });
}

function drop(at: string, reason: string, issues: Issues): null {
  issues.push(`${at}: ${reason}`);
  return null;
}

function isOccasion(value: string): value is Occasion {
  return Object.hasOwn(OCCASIONS, value);
}

function isFields(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/** Markdown and other optional text; anything that isn't a string reads as empty. */
function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
