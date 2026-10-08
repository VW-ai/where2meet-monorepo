import { isIsoDate } from '@/lib/seo/site-pages';
import type { Area, Catalog, City, CuratedPlace, Guide, Seo, Term } from './catalog';

/** Why each dropped item was dropped, as `cities[0].guides[2]: unknown occasion "brunch"`. */
export type Issues = string[];

type Fields = Record<string, unknown>;
type ParseItem<T> = (value: unknown, at: string, issues: Issues) => T | null;

/** The taxonomy's values for each guide field that names one, keyed by value key. */
type Taxonomy = Record<'occasion' | OptionalParameter, ReadonlyMap<string, Term>>;
type OptionalParameter = (typeof OPTIONAL_PARAMETERS)[number];

/** The guide fields that may be null, in the order a guide shows them. */
const OPTIONAL_PARAMETERS = ['time', 'venue_type', 'group_size', 'budget'] as const;
const SLUG = /^[a-z0-9-]+$/;
const GUIDE_SLUG_MAX_LENGTH = 80;

/**
 * Parses the control plane's published JSON (contract v2). A bad taxonomy value, city,
 * town, guide or place is dropped and reported in `issues` so the rest still renders.
 * Throws only when the payload as a whole isn't v2.
 */
export function parsePublished(raw: unknown): { catalog: Catalog; issues: Issues } {
  if (
    !isFields(raw) ||
    raw.version !== 2 ||
    !isFields(raw.taxonomy) ||
    !Array.isArray(raw.cities)
  ) {
    throw new Error('Published guides are not contract v2 JSON');
  }
  const issues: Issues = [];
  const taxonomy = parseTaxonomy(raw.taxonomy, issues);
  const cities = keyBy(
    parseList(raw.cities, 'cities', issues, (city, at) => parseCity(city, at, issues, taxonomy)),
    (city) => city.slug,
    'cities',
    issues
  );
  return { catalog: { cities }, issues };
}

function parseTaxonomy(value: Fields, issues: Issues): Taxonomy {
  const terms = (list: string) =>
    keyBy(
      parseList(value[list], `taxonomy.${list}`, issues, parseTerm),
      (term) => term.key,
      `taxonomy.${list}`,
      issues
    );
  return {
    occasion: terms('occasions'),
    time: terms('times'),
    venue_type: terms('venue_types'),
    group_size: terms('group_sizes'),
    budget: terms('budgets'),
  };
}

function parseTerm(value: unknown, at: string, issues: Issues): Term | null {
  if (!isFields(value)) return drop(at, 'not an object', issues);
  if (!isText(value.key)) return drop(at, 'missing key', issues);
  if (!isText(value.label)) return drop(at, 'missing label', issues);
  return { key: value.key, label: value.label };
}

function parseCity(value: unknown, at: string, issues: Issues, taxonomy: Taxonomy): City | null {
  const fields = parseAreaFields(value, at, issues);
  if (!fields || !isFields(value)) return null;
  const towns = keyBy(
    parseList(value.towns, `${at}.towns`, issues, (town, townAt) =>
      parseTown(town, townAt, issues, taxonomy)
    ),
    (town) => town.slug,
    `${at}.towns`,
    issues
  );
  return {
    ...fields,
    region: text(value.region),
    guides: parseGuides(value.guides, `${at}.guides`, issues, taxonomy, towns),
    towns,
  };
}

function parseTown(value: unknown, at: string, issues: Issues, taxonomy: Taxonomy): Area | null {
  const fields = parseAreaFields(value, at, issues);
  if (!fields || !isFields(value)) return null;
  return { ...fields, guides: parseGuides(value.guides, `${at}.guides`, issues, taxonomy) };
}

function parseAreaFields(value: unknown, at: string, issues: Issues): Omit<Area, 'guides'> | null {
  if (!isFields(value)) return drop(at, 'not an object', issues);
  const { slug, name, updated_at: updatedAt } = value;
  if (typeof slug !== 'string' || !SLUG.test(slug)) {
    return drop(at, `invalid slug ${JSON.stringify(slug)}`, issues);
  }
  if (!isText(name)) return drop(at, 'missing name', issues);
  if (typeof updatedAt !== 'string' || !isIsoDate(updatedAt)) {
    return drop(at, 'invalid updated_at', issues);
  }
  const seo = parseSeo(value.seo);
  if (!seo) return drop(at, 'invalid seo', issues);
  return {
    slug,
    name,
    updatedAt,
    seo,
    intro: text(value.intro),
    transitNotes: text(value.transit_notes),
  };
}

/** Guide slugs are unique within their area, and a city's guides can't take a town's slug. */
function parseGuides(
  value: unknown,
  at: string,
  issues: Issues,
  taxonomy: Taxonomy,
  towns: ReadonlyMap<string, Area> = new Map()
): ReadonlyMap<string, Guide> {
  const guides = parseList(value, at, issues, (item, guideAt) => {
    const guide = parseGuide(item, guideAt, issues, taxonomy);
    if (guide && towns.has(guide.slug)) {
      return drop(guideAt, `slug "${guide.slug}" is taken by a town`, issues);
    }
    return guide;
  });
  return keyBy(guides, (guide) => guide.slug, at, issues);
}

function parseGuide(value: unknown, at: string, issues: Issues, taxonomy: Taxonomy): Guide | null {
  if (!isFields(value)) return drop(at, 'not an object', issues);
  const { slug, updated_at: updatedAt } = value;
  if (typeof slug !== 'string' || !SLUG.test(slug)) {
    return drop(at, `invalid slug ${JSON.stringify(slug)}`, issues);
  }
  if (slug.length > GUIDE_SLUG_MAX_LENGTH) {
    return drop(at, `slug is longer than ${GUIDE_SLUG_MAX_LENGTH} characters`, issues);
  }
  const occasion = lookUp(taxonomy.occasion, value.occasion);
  if (!occasion) return drop(at, `unknown occasion ${JSON.stringify(value.occasion)}`, issues);
  const parameters: Term[] = [];
  for (const parameter of OPTIONAL_PARAMETERS) {
    const key = value[parameter] ?? null;
    if (key === null) continue;
    const term = lookUp(taxonomy[parameter], key);
    if (!term) return drop(at, `unknown ${parameter} ${JSON.stringify(key)}`, issues);
    parameters.push(term);
  }
  if (typeof updatedAt !== 'string' || !isIsoDate(updatedAt)) {
    return drop(at, 'invalid updated_at', issues);
  }
  const seo = parseSeo(value.seo);
  if (!seo) return drop(at, 'invalid seo', issues);
  const places = keyBy(
    parseList(value.places, `${at}.places`, issues, parsePlace),
    (place) => place.placeId,
    `${at}.places`,
    issues
  );
  return {
    slug,
    occasion,
    parameters,
    updatedAt,
    seo,
    intro: text(value.intro),
    tips: text(value.tips),
    places: [...places.values()],
  };
}

function lookUp(terms: ReadonlyMap<string, Term>, key: unknown): Term | undefined {
  return typeof key === 'string' ? terms.get(key) : undefined;
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

/** Keeps the first item for each key, in order, and reports the repeats. */
function keyBy<T>(
  items: T[],
  key: (item: T) => string,
  at: string,
  issues: Issues
): Map<string, T> {
  const byKey = new Map<string, T>();
  for (const item of items) {
    const value = key(item);
    if (byKey.has(value)) drop(at, `repeats "${value}"`, issues);
    else byKey.set(value, item);
  }
  return byKey;
}

function drop(at: string, reason: string, issues: Issues): null {
  issues.push(`${at}: ${reason}`);
  return null;
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
