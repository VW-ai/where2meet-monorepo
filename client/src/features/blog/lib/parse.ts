import { isIsoDate, type IsoDate } from '@/lib/seo/site-pages';
import {
  IMAGES_SEGMENT,
  imagePath,
  type Area,
  type AreaRef,
  type Catalog,
  type City,
  type CuratedPlace,
  type Post,
  type PostAreas,
  type Seo,
  type Term,
} from './catalog';
import { isLicense, type CommonsImage } from './photos';

/** Why each dropped item was dropped, as `cities[0].posts[2]: unknown occasion "brunch"`. */
export type Issues = string[];

type Fields = Record<string, unknown>;
type Taxonomy = Record<'occasion' | OptionalParameter, ReadonlyMap<string, Term>>;
type OptionalParameter = (typeof OPTIONAL_PARAMETERS)[number];

/**
 * Slugs that share one URL level, each with what holds it. An item checks its slug is
 * free before anything else and takes it only once it is kept, so a dropped item never
 * blocks a later one.
 */
type Namespace = Map<string, string>;

interface Context {
  issues: Issues;
  taxonomy: Taxonomy;
  /** Kept images' file names: one file name serves one photo across the whole payload. */
  files: Set<string>;
}

/** The post fields that may be null, in the order a post shows them. */
const OPTIONAL_PARAMETERS = ['time', 'venue_type', 'group_size', 'budget'] as const;
const SLUG = /^[a-z0-9-]+$/;
const POST_SLUG_MAX_LENGTH = 80;
const FILE_NAME = /^[a-z0-9-]+\.jpg$/;
const UPLOAD_HOSTS = ['upload.wikimedia.org', 'thumb.wikimedia.org'];
const COMMONS_FILE_PAGE = 'https://commons.wikimedia.org/wiki/File:';

/**
 * Parses the panel's published JSON (contract v3). A bad taxonomy value, city, town,
 * post, place or image is dropped and reported in `issues` so the rest still renders.
 * `repoSlugs` are the repo's posts: they hold `/blog/<slug>`, so a city or general post
 * with one of those slugs is dropped. Throws only when the payload as a whole isn't v3.
 */
export function parsePublished(
  raw: unknown,
  repoSlugs: readonly string[]
): { catalog: Catalog; issues: Issues } {
  if (
    !isFields(raw) ||
    raw.version !== 3 ||
    !isFields(raw.taxonomy) ||
    !Array.isArray(raw.posts) ||
    !Array.isArray(raw.cities)
  ) {
    throw new Error('Published posts are not contract v3 JSON');
  }
  const issues: Issues = [];
  const context: Context = {
    issues,
    taxonomy: parseTaxonomy(raw.taxonomy, issues),
    files: new Set(),
  };
  const topLevel: Namespace = new Map([
    [IMAGES_SEGMENT, 'the photo route'],
    ...repoSlugs.map((slug): [string, string] => [slug, 'a repo post']),
  ]);

  const cities = new Map<string, City>();
  const posts: Post[] = [];
  raw.cities.forEach((value, index) => {
    const parsed = parseCity(value, `cities[${index}]`, context, topLevel);
    if (!parsed) return;
    cities.set(parsed.city.slug, parsed.city);
    posts.push(...parsed.posts);
  });
  posts.push(...parsePosts(raw.posts, 'posts', context, topLevel, []));
  return { catalog: { posts, cities }, issues };
}

function parseTaxonomy(value: Fields, issues: Issues): Taxonomy {
  const terms = (list: string) => {
    const byKey = new Map<string, Term>();
    listOf(value[list]).forEach((item, index) => {
      const at = `taxonomy.${list}[${index}]`;
      if (!isFields(item)) return drop(at, 'not an object', issues);
      if (!isText(item.key)) return drop(at, 'missing key', issues);
      if (!isText(item.label)) return drop(at, 'missing label', issues);
      if (byKey.has(item.key)) return drop(at, `repeats "${item.key}"`, issues);
      byKey.set(item.key, { key: item.key, label: item.label });
    });
    return byKey;
  };
  return {
    occasion: terms('occasions'),
    time: terms('times'),
    venue_type: terms('venue_types'),
    group_size: terms('group_sizes'),
    budget: terms('budgets'),
  };
}

/** A city, its towns, and the posts in the city and in each town. */
function parseCity(
  value: unknown,
  at: string,
  context: Context,
  topLevel: Namespace
): { city: City; posts: Post[] } | null {
  const area = parseArea(value, at, context, topLevel, 'a city');
  if (!area || !isFields(value)) return null;
  const cityRef: AreaRef = { slug: area.slug, name: area.name };
  const children: Namespace = new Map();
  const towns = new Map<string, Area>();
  const posts: Post[] = [];

  listOf(value.towns).forEach((townValue, index) => {
    const townAt = `${at}.towns[${index}]`;
    const town = parseArea(townValue, townAt, context, children, 'a town');
    if (!town || !isFields(townValue)) return;
    towns.set(town.slug, town);
    const townRef: AreaRef = { slug: town.slug, name: town.name };
    posts.push(
      ...parsePosts(townValue.posts, `${townAt}.posts`, context, new Map(), [cityRef, townRef])
    );
  });
  posts.push(...parsePosts(value.posts, `${at}.posts`, context, children, [cityRef]));
  return { city: { ...area, region: text(value.region), towns }, posts };
}

function parseArea(
  value: unknown,
  at: string,
  context: Context,
  namespace: Namespace,
  holder: string
): Area | null {
  const { issues } = context;
  if (!isFields(value)) return drop(at, 'not an object', issues);
  const { slug, name, updated_at: updatedAt } = value;
  if (!isSlug(slug)) return drop(at, `invalid slug ${JSON.stringify(slug)}`, issues);
  const taken = namespace.get(slug);
  if (taken) return drop(at, `slug "${slug}" is taken by ${taken}`, issues);
  if (!isText(name)) return drop(at, 'missing name', issues);
  if (!isDate(updatedAt)) return drop(at, 'invalid updated_at', issues);
  const seo = parseSeo(value.seo);
  if (!seo) return drop(at, 'invalid seo', issues);
  const image =
    value.image === null || value.image === undefined
      ? null
      : parseImage(value.image, `${at}.image`, context);
  namespace.set(slug, holder);
  return {
    slug,
    name,
    updatedAt,
    seo,
    intro: text(value.intro),
    transitNotes: text(value.transit_notes),
    image,
  };
}

function parsePosts(
  value: unknown,
  at: string,
  context: Context,
  namespace: Namespace,
  areas: PostAreas
): Post[] {
  return listOf(value).flatMap(
    (item, index) => parsePost(item, `${at}[${index}]`, context, namespace, areas) ?? []
  );
}

function parsePost(
  value: unknown,
  at: string,
  context: Context,
  namespace: Namespace,
  areas: PostAreas
): Post | null {
  const { issues, taxonomy } = context;
  if (!isFields(value)) return drop(at, 'not an object', issues);
  const { slug, published_at: publishedAt, updated_at: updatedAt } = value;
  if (!isSlug(slug)) return drop(at, `invalid slug ${JSON.stringify(slug)}`, issues);
  if (slug.length > POST_SLUG_MAX_LENGTH) {
    return drop(at, `slug is longer than ${POST_SLUG_MAX_LENGTH} characters`, issues);
  }
  const taken = namespace.get(slug);
  if (taken) return drop(at, `slug "${slug}" is taken by ${taken}`, issues);
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
  if (!isDate(publishedAt)) return drop(at, 'invalid published_at', issues);
  if (!isDate(updatedAt)) return drop(at, 'invalid updated_at', issues);
  const seo = parseSeo(value.seo);
  if (!seo) return drop(at, 'invalid seo', issues);
  const places = parsePlaces(value.places, `${at}.places`, issues);
  const [cover, ...images] = listOf(value.images).flatMap(
    (item, index) => parseImage(item, `${at}.images[${index}]`, context) ?? []
  );
  if (!cover) return drop(at, 'no image to use as its cover', issues);
  namespace.set(slug, 'a post');
  const area = areas.at(-1);
  return {
    slug,
    areas,
    title: seo.title,
    description: seo.description,
    publishedAt,
    updatedAt,
    occasion,
    parameters,
    places,
    placesTitle: area ? `Our picks in ${area.name}` : 'Our picks',
    source: { kind: 'panel', markdown: text(value.body), images: [cover, ...images] },
  };
}

function parsePlaces(value: unknown, at: string, issues: Issues): CuratedPlace[] {
  const byId = new Map<string, CuratedPlace>();
  listOf(value).forEach((item, index) => {
    const placeAt = `${at}[${index}]`;
    if (!isFields(item)) return drop(placeAt, 'not an object', issues);
    if (!isText(item.place_id)) return drop(placeAt, 'missing place_id', issues);
    if (!isText(item.label)) return drop(placeAt, 'missing label', issues);
    if (byId.has(item.place_id)) return drop(placeAt, `repeats "${item.place_id}"`, issues);
    byId.set(item.place_id, { placeId: item.place_id, label: item.label, note: text(item.note) });
  });
  return [...byId.values()];
}

function parseImage(value: unknown, at: string, context: Context): CommonsImage | null {
  const { issues, files } = context;
  if (!isFields(value)) return drop(at, 'not an object', issues);
  const { file_name: fileName, source_url: sourceUrl, page_url: pageUrl, width, height } = value;
  if (typeof fileName !== 'string' || !FILE_NAME.test(fileName)) {
    return drop(at, `invalid file_name ${JSON.stringify(fileName)}`, issues);
  }
  if (files.has(fileName)) return drop(at, `file_name "${fileName}" is already used`, issues);
  if (!isUploadUrl(sourceUrl)) return drop(at, 'source_url is not a Wikimedia upload', issues);
  if (typeof pageUrl !== 'string' || !pageUrl.startsWith(COMMONS_FILE_PAGE)) {
    return drop(at, 'page_url is not a Wikimedia Commons file page', issues);
  }
  if (!isPositiveInteger(width) || !isPositiveInteger(height)) {
    return drop(at, 'invalid width or height', issues);
  }
  if (!isText(value.alt)) return drop(at, 'missing alt', issues);
  if (!isText(value.author)) return drop(at, 'missing author', issues);
  if (!isLicense(value.license)) {
    return drop(at, `license ${JSON.stringify(value.license)} is not allowed`, issues);
  }
  files.add(fileName);
  return {
    fileName,
    sourceUrl,
    src: imagePath(fileName),
    width,
    height,
    alt: value.alt,
    caption: text(value.caption),
    credit: {
      author: value.author,
      license: value.license,
      pageUrl,
      cropped: value.cropped === true,
    },
  };
}

function isUploadUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && UPLOAD_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}

function lookUp(terms: ReadonlyMap<string, Term>, key: unknown): Term | undefined {
  return typeof key === 'string' ? terms.get(key) : undefined;
}

function parseSeo(value: unknown): Seo | null {
  if (!isFields(value) || !isText(value.title) || !isText(value.description)) return null;
  return { title: value.title, description: value.description };
}

/** A missing list reads as empty. */
function listOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function drop(at: string, reason: string, issues: Issues): null {
  issues.push(`${at}: ${reason}`);
  return null;
}

function isSlug(value: unknown): value is string {
  return typeof value === 'string' && SLUG.test(value);
}

function isDate(value: unknown): value is IsoDate {
  return typeof value === 'string' && isIsoDate(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
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
