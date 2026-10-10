import { isIsoDate, type IsoDate } from '@/lib/seo/site-pages';
import {
  IMAGES_SEGMENT,
  imagePath,
  type Area,
  type AreaRef,
  type BudgetTerm,
  type Catalog,
  type City,
  type CuratedPlace,
  type LatLng,
  type OccasionTerm,
  type Post,
  type PostAreas,
  type Seo,
  type Taxonomy,
  type Term,
  type VenueTypeTerm,
} from './catalog';
import {
  PLACES_DIR,
  POSTS_DIR,
  TAXONOMY_FILE,
  filePath,
  fileSegments,
  isFields,
  isText,
  listOf,
  readFrontMatter,
  readYaml,
  type ContentFile,
  type Fields,
} from './content-file';
import { isLicense, type CommonsImage } from './photos';

/** Why the site skips a file or part of one. `file` is relative to the client root. */
export interface Issue {
  file: string;
  message: string;
}

export interface RepoContent {
  mdx: readonly Post[];
  taxonomyText: string;
  /** Named relative to `PLACES_DIR`: `new-york.md` or `new-york/midtown.md`. */
  places: readonly ContentFile[];
  /** Named relative to `POSTS_DIR`: `<slug>.md`. */
  posts: readonly ContentFile[];
}

type OptionalParameter = (typeof OPTIONAL_PARAMETERS)[number];
type Parameter = 'occasion' | OptionalParameter;
type TermLookup = (parameter: Parameter, key: unknown) => Term | undefined;

type Drop = (reason: string) => null;
type Reason = string;
/** Who holds each segment below one path. */
type Namespace = Map<string, string>;
type ParsedCity = City & { towns: Map<string, Area> };
type AreaLookup = (frontMatter: Fields) => PostAreas | Reason;

interface Context {
  terms: TermLookup;
  /** Every photo's file name so far, since /blog/images serves them side by side. */
  fileNames: Set<string>;
  /** Keyed by the parent's segments joined with "/", so "" is /blog itself. */
  namespaces: Map<string, Namespace>;
  placeFiles: ReadonlySet<string>;
}

const OPTIONAL_PARAMETERS = ['time', 'venue_type', 'group_size', 'budget'] as const;
const SLUG = /^[a-z0-9-]+$/;
const POST_SLUG_MAX_LENGTH = 80;
const FILE_NAME = /^[a-z0-9-]+\.jpg$/;
const UPLOAD_HOSTS = ['upload.wikimedia.org', 'thumb.wikimedia.org'];
const COMMONS_FILE_PAGE = 'https://commons.wikimedia.org/wiki/File:';
const GETTING_AROUND = '## Getting around';

const TAXONOMY_FIELDS = {
  occasions: ['key', 'label', 'times', 'venue_types', 'group_sizes'],
  times: ['key', 'label'],
  venue_types: ['key', 'label', 'google_type'],
  group_sizes: ['key', 'label'],
  budgets: ['key', 'label', 'price_level'],
} as const satisfies Record<string, readonly string[]>;
type TaxonomyList = keyof typeof TAXONOMY_FIELDS;
const EMPTY_TAXONOMY: Taxonomy = {
  occasions: [],
  times: [],
  venueTypes: [],
  groupSizes: [],
  budgets: [],
};
const GOOGLE_TYPE = /^[a-z]+(?:_[a-z]+)*$/;
const TEXT_SEARCH_PRICE_LEVELS = [
  'PRICE_LEVEL_INEXPENSIVE',
  'PRICE_LEVEL_MODERATE',
  'PRICE_LEVEL_EXPENSIVE',
  'PRICE_LEVEL_VERY_EXPENSIVE',
];

export function parseCatalog(repo: RepoContent): { catalog: Catalog; issues: Issue[] } {
  const issues: Issue[] = [];
  const taxonomy = parseTaxonomy(repo.taxonomyText, dropper(issues, TAXONOMY_FILE));
  const general: Namespace = new Map([
    [IMAGES_SEGMENT, 'the photo route'],
    ...repo.mdx.map(({ slug }): [string, string] => [slug, 'an MDX post']),
  ]);
  const context: Context = {
    terms: termLookup(taxonomy),
    fileNames: new Set(),
    namespaces: new Map([['', general]]),
    placeFiles: new Set(repo.places.map(({ name }) => name)),
  };
  const cities = parsePlaces(repo.places, context, issues);
  const lookUpAreas = areaLookup(cities, context);
  const markdown = repo.posts.flatMap(
    (file) =>
      parsePost(file, lookUpAreas, context, dropper(issues, filePath(POSTS_DIR, file.name))) ?? []
  );
  const posts = [...repo.mdx, ...markdown].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt)
  );
  return { catalog: { taxonomy, posts, cities }, issues };
}

/** Keeps every value that fits the schema, and drops each one that doesn't with a reason. */
function parseTaxonomy(text: string, drop: Drop): Taxonomy {
  const yaml = readYaml(text);
  if (!yaml.ok) {
    drop(`not valid YAML: ${yaml.problem}`);
    return EMPTY_TAXONOMY;
  }
  if (!isFields(yaml.value)) {
    drop('not a YAML mapping of lists');
    return EMPTY_TAXONOMY;
  }
  const lists = yaml.value;
  for (const name of Object.keys(lists)) {
    if (!Object.hasOwn(TAXONOMY_FIELDS, name)) drop(`unknown list "${name}"`);
  }

  const read = <T extends Term>(
    name: TaxonomyList,
    toTerm: (term: Term, item: Fields, drop: Drop) => T | null
  ): T[] => {
    const list = lists[name];
    if (!Array.isArray(list)) {
      drop(`"${name}" is not a list`);
      return [];
    }
    const terms = new Map<string, T>();
    list.forEach((item, index) => {
      const itemDrop = within(drop, `${name}[${index}]`);
      if (!isFields(item)) return itemDrop('not an object');
      const base = baseTerm(item, TAXONOMY_FIELDS[name], itemDrop);
      const term = base && toTerm(base, item, itemDrop);
      if (!term) return;
      if (terms.has(term.key)) return itemDrop(`repeats "${term.key}"`);
      terms.set(term.key, term);
    });
    return [...terms.values()];
  };

  const times = read('times', (term) => term);
  const venueTypes = read('venue_types', (term, item, itemDrop): VenueTypeTerm | null => {
    const { google_type: googleType } = item;
    if (typeof googleType !== 'string' || !GOOGLE_TYPE.test(googleType)) {
      return itemDrop(`invalid google_type ${JSON.stringify(googleType)}`);
    }
    return { ...term, googleType };
  });
  const groupSizes = read('group_sizes', (term) => term);
  const budgets = read('budgets', (term, item, itemDrop): BudgetTerm | null => {
    const { price_level: priceLevel } = item;
    if (typeof priceLevel !== 'string' || !TEXT_SEARCH_PRICE_LEVELS.includes(priceLevel)) {
      return itemDrop(`invalid price_level ${JSON.stringify(priceLevel)}`);
    }
    return { ...term, priceLevel };
  });
  const occasions = read(
    'occasions',
    (term, item, itemDrop): OccasionTerm => ({
      ...term,
      times: knownKeys(item, 'times', 'time', times, itemDrop),
      venueTypes: knownKeys(item, 'venue_types', 'venue_type', venueTypes, itemDrop),
      groupSizes: knownKeys(item, 'group_sizes', 'group_size', groupSizes, itemDrop),
    })
  );
  return { occasions, times, venueTypes, groupSizes, budgets };
}

function baseTerm(item: Fields, fields: readonly string[], drop: Drop): Term | null {
  if (!isText(item.key)) return drop('missing key');
  if (!isSlug(item.key)) return drop(`invalid key ${JSON.stringify(item.key)}`);
  if (!isText(item.label)) return drop('missing label');
  const unknown = Object.keys(item).find((field) => !fields.includes(field));
  if (unknown) return drop(`unknown field "${unknown}"`);
  return { key: item.key, label: item.label };
}

/** An occasion's suggested keys, without any its list doesn't define. */
function knownKeys(
  occasion: Fields,
  list: 'times' | 'venue_types' | 'group_sizes',
  parameter: OptionalParameter,
  terms: readonly Term[],
  drop: Drop
): string[] {
  const keys = occasion[list];
  if (!Array.isArray(keys)) {
    drop(`${list} is not a list`);
    return [];
  }
  return keys.filter((key) => {
    if (terms.some((term) => term.key === key)) return true;
    drop(`unknown ${parameter} ${JSON.stringify(key)}`);
    return false;
  });
}

function termLookup(taxonomy: Taxonomy): TermLookup {
  const byKey = (terms: readonly Term[]) =>
    new Map(terms.map(({ key, label }): [string, Term] => [key, { key, label }]));
  const lists: Record<Parameter, ReadonlyMap<string, Term>> = {
    occasion: byKey(taxonomy.occasions),
    time: byKey(taxonomy.times),
    venue_type: byKey(taxonomy.venueTypes),
    group_size: byKey(taxonomy.groupSizes),
    budget: byKey(taxonomy.budgets),
  };
  return (parameter, key) => (typeof key === 'string' ? lists[parameter].get(key) : undefined);
}

/** Cities first, so each town finds its city whatever order the files come in. */
function parsePlaces(
  files: readonly ContentFile[],
  context: Context,
  issues: Issue[]
): Map<string, City> {
  const cities = new Map<string, ParsedCity>();
  const byDepth = files.toSorted(
    (a, b) => fileSegments(a.name).length - fileSegments(b.name).length
  );
  for (const file of byDepth) {
    const drop = dropper(issues, filePath(PLACES_DIR, file.name));
    const segments = fileSegments(file.name);
    if (segments.length === 1) {
      const city = parseCity(file, segments[0], context, drop);
      if (city) cities.set(city.slug, city);
    } else if (segments.length === 2) {
      const [citySlug, slug] = segments;
      const city = cities.get(citySlug);
      if (!city) {
        drop(missingPlace('city', citySlug, `${citySlug}.md`, context));
        continue;
      }
      const town = parseTown(file, slug, citySlug, context, drop);
      if (town) city.towns.set(town.slug, town);
    } else {
      drop('a place file is <city>.md or <city>/<town>.md');
    }
  }
  return cities;
}

function parseCity(
  file: ContentFile,
  slug: string,
  context: Context,
  drop: Drop
): ParsedCity | null {
  const content = readFrontMatter(file.text);
  if (!content.ok) return drop(content.problem);
  const area = readArea(content, slug, drop);
  if (!area) return null;
  const { region, country, image } = content.frontMatter;
  if (!isText(region)) return drop('missing region');
  if (!isText(country)) return drop('missing country');
  const city = claimArea(area, image, [], 'a city', context, drop);
  return city && { ...city, region, country, towns: new Map() };
}

function parseTown(
  file: ContentFile,
  slug: string,
  citySlug: string,
  context: Context,
  drop: Drop
): Area | null {
  const content = readFrontMatter(file.text);
  if (!content.ok) return drop(content.problem);
  const area = readArea(content, slug, drop);
  return area && claimArea(area, content.frontMatter.image, [citySlug], 'a town', context, drop);
}

function readArea(
  { frontMatter, body }: { frontMatter: Fields; body: string },
  slug: string,
  drop: Drop
): Omit<Area, 'image'> | null {
  const { name, updated_at: updatedAt } = frontMatter;
  if (!isSlug(slug)) return drop(`invalid slug ${JSON.stringify(slug)}`);
  if (!isText(name)) return drop('missing name');
  const center = parseCenter(frontMatter.center);
  if (!center) return drop('invalid center');
  if (!isDate(updatedAt)) return drop('invalid updated_at');
  const seo = parseSeo(frontMatter.seo);
  if (!seo) return drop('invalid seo');
  return { slug, name, updatedAt, seo, center, ...placeBody(body) };
}

/** A place takes its slug and photo only once nothing else can drop it. */
function claimArea(
  area: Omit<Area, 'image'>,
  image: unknown,
  parent: readonly string[],
  holder: string,
  context: Context,
  drop: Drop
): Area | null {
  const names = namespace(context, parent);
  const taken = names.get(area.slug);
  if (taken) return drop(`slug "${area.slug}" is taken by ${taken}`);
  names.set(area.slug, holder);
  const photo =
    image === null || image === undefined
      ? null
      : parseImage(image, context, within(drop, 'image'));
  return { ...area, image: photo };
}

function placeBody(body: string): { intro: string; transitNotes: string } {
  const lines = body.split('\n');
  const heading = lines.findIndex((line) => line.trim() === GETTING_AROUND);
  if (heading === -1) return { intro: body.trim(), transitNotes: '' };
  return {
    intro: lines.slice(0, heading).join('\n').trim(),
    transitNotes: lines
      .slice(heading + 1)
      .join('\n')
      .trim(),
  };
}

function parseCenter(value: unknown): LatLng | null {
  if (!isFields(value)) return null;
  const { lat, lng } = value;
  return isCoordinate(lat, 90) && isCoordinate(lng, 180) ? { lat, lng } : null;
}

function isCoordinate(value: unknown, limit: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;
}

function areaLookup(cities: ReadonlyMap<string, City>, context: Context): AreaLookup {
  return (frontMatter) => {
    const slugs = areaSlugs(frontMatter);
    if (typeof slugs === 'string') return slugs;
    const [citySlug, townSlug] = slugs;
    if (citySlug === undefined) return [];
    const city = cities.get(citySlug);
    if (!city) return missingPlace('city', citySlug, `${citySlug}.md`, context);
    const cityRef: AreaRef = { slug: city.slug, name: city.name };
    if (townSlug === undefined) return [cityRef];
    const town = city.towns.get(townSlug);
    if (!town) return missingPlace('town', townSlug, `${citySlug}/${townSlug}.md`, context);
    return [cityRef, { slug: town.slug, name: town.name }];
  };
}

function missingPlace(
  kind: 'city' | 'town',
  slug: string,
  name: string,
  { placeFiles }: Context
): Reason {
  const file = filePath(PLACES_DIR, name);
  return placeFiles.has(name)
    ? `${kind} "${slug}" has a place file the site skips, ${file}`
    : `${kind} "${slug}" has no place file, ${file}`;
}

function areaSlugs(frontMatter: Fields): readonly [] | [string] | [string, string] | Reason {
  const city = frontMatter.city ?? null;
  const town = frontMatter.town ?? null;
  if (city === null) return town === null ? [] : 'town is set without a city';
  if (!isSlug(city)) return `invalid city ${JSON.stringify(city)}`;
  if (town === null) return [city];
  if (!isSlug(town)) return `invalid town ${JSON.stringify(town)}`;
  return [city, town];
}

function namespace({ namespaces }: Context, parent: readonly string[]): Namespace {
  const key = parent.join('/');
  const names = namespaces.get(key) ?? new Map();
  namespaces.set(key, names);
  return names;
}

function parsePost(
  file: ContentFile,
  lookUpAreas: AreaLookup,
  context: Context,
  drop: Drop
): Post | null {
  const content = readFrontMatter(file.text);
  if (!content.ok) return drop(content.problem);
  const { frontMatter: value, body } = content;
  const [slug] = fileSegments(file.name);
  if (!isSlug(slug)) return drop(`invalid slug ${JSON.stringify(slug)}`);
  if (slug.length > POST_SLUG_MAX_LENGTH) {
    return drop(`slug is longer than ${POST_SLUG_MAX_LENGTH} characters`);
  }
  const areas = lookUpAreas(value);
  if (typeof areas === 'string') return drop(areas);
  const names = namespace(
    context,
    areas.map((area) => area.slug)
  );
  const taken = names.get(slug);
  if (taken) return drop(`slug "${slug}" is taken by ${taken}`);
  const occasion = context.terms('occasion', value.occasion);
  if (!occasion) return drop(`unknown occasion ${JSON.stringify(value.occasion)}`);
  const parameters: Term[] = [];
  for (const parameter of OPTIONAL_PARAMETERS) {
    const key = value[parameter] ?? null;
    if (key === null) continue;
    const term = context.terms(parameter, key);
    if (!term) return drop(`unknown ${parameter} ${JSON.stringify(key)}`);
    parameters.push(term);
  }
  const { title, description, published_at: publishedAt, updated_at: updatedAt } = value;
  if (!isDate(publishedAt)) return drop('invalid published_at');
  if (!isDate(updatedAt)) return drop('invalid updated_at');
  if (!isText(title)) return drop('missing title');
  if (!isText(description)) return drop('missing description');
  const places = parseCuratedPlaces(value.places, drop);
  const [cover, ...images] = listOf(value.images).flatMap(
    (item, index) => parseImage(item, context, within(drop, `images[${index}]`)) ?? []
  );
  if (!cover) return drop('no image to use as its cover');
  names.set(slug, 'a post');
  const area = areas.at(-1);
  return {
    slug,
    areas,
    title,
    description,
    publishedAt,
    updatedAt,
    occasion,
    parameters,
    places,
    placesTitle: area ? `Our picks in ${area.name}` : 'Our picks',
    source: { kind: 'markdown', markdown: body, images: [cover, ...images] },
  };
}

function parseCuratedPlaces(value: unknown, drop: Drop): CuratedPlace[] {
  const byId = new Map<string, CuratedPlace>();
  listOf(value).forEach((item, index) => {
    const placeDrop = within(drop, `places[${index}]`);
    if (!isFields(item)) return placeDrop('not an object');
    if (!isText(item.place_id)) return placeDrop('missing place_id');
    if (!isText(item.label)) return placeDrop('missing label');
    if (byId.has(item.place_id)) return placeDrop(`repeats "${item.place_id}"`);
    byId.set(item.place_id, { placeId: item.place_id, label: item.label, note: text(item.note) });
  });
  return [...byId.values()];
}

function parseImage(value: unknown, { fileNames }: Context, drop: Drop): CommonsImage | null {
  if (!isFields(value)) return drop('not an object');
  const { file_name: fileName, source_url: sourceUrl, page_url: pageUrl, width, height } = value;
  if (typeof fileName !== 'string' || !FILE_NAME.test(fileName)) {
    return drop(`invalid file_name ${JSON.stringify(fileName)}`);
  }
  if (fileNames.has(fileName)) return drop(`file_name "${fileName}" is already used`);
  if (!isUploadUrl(sourceUrl)) return drop('source_url is not a Wikimedia JPEG upload');
  if (typeof pageUrl !== 'string' || !pageUrl.startsWith(COMMONS_FILE_PAGE)) {
    return drop('page_url is not a Wikimedia Commons file page');
  }
  if (!isPositiveInteger(width) || !isPositiveInteger(height)) {
    return drop('invalid width or height');
  }
  if (!isText(value.alt)) return drop('missing alt');
  if (!isText(value.author)) return drop('missing author');
  if (!isLicense(value.license)) {
    return drop(`license ${JSON.stringify(value.license)} is not allowed`);
  }
  fileNames.add(fileName);
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
    return (
      url.protocol === 'https:' &&
      UPLOAD_HOSTS.includes(url.hostname) &&
      /\.jpe?g$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function parseSeo(value: unknown): Seo | null {
  if (!isFields(value) || !isText(value.title) || !isText(value.description)) return null;
  return { title: value.title, description: value.description };
}

function dropper(issues: Issue[], file: string): Drop {
  return (message) => {
    issues.push({ file, message });
    return null;
  };
}

function within(drop: Drop, at: string): Drop {
  return (reason) => drop(`${at}: ${reason}`);
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

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
