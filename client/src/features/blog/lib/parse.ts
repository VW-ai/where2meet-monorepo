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
import {
  isFields,
  isText,
  listOf,
  postFilePath,
  postFileSlug,
  readPostFile,
  readYaml,
  writtenFileNames,
  type Fields,
  type PostFile,
  type PostFileContent,
} from './post-file';

export type Issues = string[];

type OptionalParameter = (typeof OPTIONAL_PARAMETERS)[number];
type Parameter = 'occasion' | OptionalParameter;

export type TermLookup = (parameter: Parameter, key: unknown) => Term | undefined;

type Namespace = Map<string, string>;

type Segments = readonly string[];

type Reason = string;

type AreaSlugs = readonly [] | readonly [string] | readonly [string, string];

type AreaLookup = (city: string, town: string | undefined) => PostAreas | Reason;

interface RepoClaims {
  paths: readonly Segments[];
  fileNames: readonly string[];
}

interface Context {
  issues: Issues;
  taxonomy: TermLookup;
  files: Set<string>;
}

export interface RepoContent {
  mdx: readonly Post[];
  files: readonly PostFile[];
  taxonomyText: string;
}

const OPTIONAL_PARAMETERS = ['time', 'venue_type', 'group_size', 'budget'] as const;
const SLUG = /^[a-z0-9-]+$/;
const POST_SLUG_MAX_LENGTH = 80;
const FILE_NAME = /^[a-z0-9-]+\.jpg$/;
const UPLOAD_HOSTS = ['upload.wikimedia.org', 'thumb.wikimedia.org'];
const COMMONS_FILE_PAGE = 'https://commons.wikimedia.org/wiki/File:';
const NO_PANEL: Catalog = { posts: [], cities: new Map() };

export const TAXONOMY_FILE = 'src/content/taxonomy.yaml';
const LISTS = {
  occasion: 'occasions',
  time: 'times',
  venue_type: 'venue_types',
  group_size: 'group_sizes',
  budget: 'budgets',
} as const satisfies Record<Parameter, string>;
const TAXONOMY_FIELDS: Record<Parameter, readonly string[]> = {
  occasion: ['key', 'label', 'times', 'venue_types', 'group_sizes'],
  time: ['key', 'label'],
  venue_type: ['key', 'label', 'google_type'],
  group_size: ['key', 'label'],
  budget: ['key', 'label', 'price_level'],
};
const GOOGLE_TYPE = /^[a-z]+(?:_[a-z]+)*$/;
const TEXT_SEARCH_PRICE_LEVELS = [
  'PRICE_LEVEL_INEXPENSIVE',
  'PRICE_LEVEL_MODERATE',
  'PRICE_LEVEL_EXPENSIVE',
  'PRICE_LEVEL_VERY_EXPENSIVE',
];

export function parseCatalog(
  repo: RepoContent,
  panel?: unknown
): { catalog: Catalog; issues: Issues } {
  const issues: Issues = [];
  const files = repo.files.map((file) => ({ file, content: readPostFile(file.text) }));
  const published =
    panel === undefined ? NO_PANEL : parsePanel(panel, claimsAsWritten(repo.mdx, files), issues);
  const taxonomy = readTaxonomy(repo.taxonomyText);
  issues.push(...taxonomy.issues);
  const context: Context = { issues, taxonomy: taxonomy.taxonomy, files: new Set() };
  const general: Namespace = new Map([
    [IMAGES_SEGMENT, 'the photo route'],
    ...repo.mdx.map(({ slug }): [string, string] => [slug, 'an MDX post']),
  ]);
  const areas = publishedAreas(published.cities);
  const markdown = files.flatMap(
    ({ file, content }) =>
      parseRepoPost(file, content, postFilePath(file), context, general, areas) ?? []
  );
  const posts = [...repo.mdx, ...markdown, ...published.posts].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt)
  );
  return { catalog: { posts, cities: published.cities }, issues };
}

export function parseStandalone(
  file: PostFile,
  content: PostFileContent,
  taxonomy: TermLookup,
  at: string
): { post: Post | null; issues: Issues } {
  const issues: Issues = [];
  const context: Context = { issues, taxonomy, files: new Set() };
  const slugAsName = (slug: string): AreaRef => ({ slug, name: slug });
  const post = parseRepoPost(file, content, at, context, new Map(), (city, town) =>
    town === undefined ? [slugAsName(city)] : [slugAsName(city), slugAsName(town)]
  );
  return { post, issues };
}

function parsePanel(raw: unknown, claims: RepoClaims, issues: Issues): Catalog {
  if (
    !isFields(raw) ||
    raw.version !== 3 ||
    !isFields(raw.taxonomy) ||
    !Array.isArray(raw.posts) ||
    !Array.isArray(raw.cities)
  ) {
    throw new Error('Published posts are not contract v3 JSON');
  }
  const context: Context = {
    issues,
    taxonomy: parseTaxonomy(raw.taxonomy, 'taxonomy', issues),
    files: new Set(claims.fileNames),
  };
  const topLevel = claimedNamespace(claims, [], [[IMAGES_SEGMENT, 'the photo route']]);

  const cities = new Map<string, City>();
  const posts: Post[] = [];
  raw.cities.forEach((value, index) => {
    const parsed = parseCity(value, `cities[${index}]`, context, topLevel, claims);
    if (!parsed) return;
    cities.set(parsed.city.slug, parsed.city);
    posts.push(...parsed.posts);
  });
  posts.push(...parsePosts(raw.posts, 'posts', context, topLevel, []));
  return { posts, cities };
}

export function readTaxonomy(text: string): { taxonomy: TermLookup; issues: Issues } {
  const issues: Issues = [];
  const yaml = readYaml(text);
  const lists = yaml.ok && isFields(yaml.value) ? yaml.value : {};
  return { taxonomy: parseTaxonomy(lists, TAXONOMY_FILE, issues), issues };
}

/** Everything `readTaxonomy` drops, plus the schema the site doesn't read: CI fails on any. */
export function checkTaxonomy(text: string): Issues {
  const issues: Issues = [];
  const yaml = readYaml(text);
  if (!yaml.ok) {
    drop(TAXONOMY_FILE, `not valid YAML: ${yaml.problem}`, issues);
    return issues;
  }
  if (!isFields(yaml.value)) drop(TAXONOMY_FILE, 'not a YAML mapping of lists', issues);
  const lists = isFields(yaml.value) ? yaml.value : {};
  const names: readonly string[] = Object.values(LISTS);
  for (const name of Object.keys(lists)) {
    if (!names.includes(name)) drop(TAXONOMY_FILE, `unknown list "${name}"`, issues);
  }
  for (const name of names) {
    if (!Array.isArray(lists[name])) drop(TAXONOMY_FILE, `"${name}" is not a list`, issues);
  }
  const taxonomy = parseTaxonomy(lists, TAXONOMY_FILE, issues);
  for (const [parameter, list] of Object.entries(LISTS) as [Parameter, string][]) {
    listOf(lists[list]).forEach((value, index) => {
      if (!isFields(value) || !taxonomy(parameter, value.key)) return;
      const reason = schemaProblem(parameter, value);
      if (reason) drop(`${TAXONOMY_FILE}.${list}[${index}]`, reason, issues);
    });
  }
  listOf(lists.occasions).forEach((occasion, index) => {
    if (!isFields(occasion)) return;
    for (const parameter of ['time', 'venue_type', 'group_size'] as const) {
      const at = `${TAXONOMY_FILE}.occasions[${index}].${LISTS[parameter]}`;
      const keys = occasion[LISTS[parameter]];
      if (!Array.isArray(keys)) {
        drop(at, 'is not a list', issues);
        continue;
      }
      for (const key of keys) {
        if (!taxonomy(parameter, key)) {
          drop(at, `unknown ${parameter} ${JSON.stringify(key)}`, issues);
        }
      }
    }
  });
  return issues;
}

function schemaProblem(parameter: Parameter, value: Fields): string | null {
  const unknown = Object.keys(value).find((field) => !TAXONOMY_FIELDS[parameter].includes(field));
  if (unknown) return `unknown field "${unknown}"`;
  if (!isSlug(value.key)) return `invalid key ${JSON.stringify(value.key)}`;
  const { google_type: googleType, price_level: priceLevel } = value;
  if (
    parameter === 'venue_type' &&
    !(typeof googleType === 'string' && GOOGLE_TYPE.test(googleType))
  ) {
    return `invalid google_type ${JSON.stringify(googleType)}`;
  }
  if (
    parameter === 'budget' &&
    !(typeof priceLevel === 'string' && TEXT_SEARCH_PRICE_LEVELS.includes(priceLevel))
  ) {
    return `invalid price_level ${JSON.stringify(priceLevel)}`;
  }
  return null;
}

function claimsAsWritten(
  mdx: readonly Post[],
  files: readonly { file: PostFile; content: PostFileContent }[]
): RepoClaims {
  const paths: Segments[] = mdx.map(({ slug }) => [slug]);
  const fileNames: string[] = [];
  for (const { file, content } of files) {
    if (!content.ok) continue;
    const slugs = areaSlugs(content.frontMatter);
    paths.push([...(typeof slugs === 'string' ? [] : slugs), postFileSlug(file)]);
    fileNames.push(...writtenFileNames(content.frontMatter));
  }
  return { paths, fileNames };
}

function claimedNamespace(
  claims: RepoClaims,
  parent: Segments,
  entries: [string, string][] = []
): Namespace {
  const namespace: Namespace = new Map(entries);
  for (const path of claims.paths) {
    if (path.length === parent.length + 1 && parent.every((slug, i) => path[i] === slug)) {
      namespace.set(path[parent.length], 'a repo post');
    }
  }
  return namespace;
}

function publishedAreas(cities: ReadonlyMap<string, City>): AreaLookup {
  return (citySlug, townSlug) => {
    const city = cities.get(citySlug);
    if (!city) return `city "${citySlug}" is not published`;
    const cityRef: AreaRef = { slug: city.slug, name: city.name };
    if (townSlug === undefined) return [cityRef];
    const town = city.towns.get(townSlug);
    if (!town) return `town "${townSlug}" is not published in ${city.slug}`;
    return [cityRef, { slug: town.slug, name: town.name }];
  };
}

function parseRepoPost(
  file: PostFile,
  content: PostFileContent,
  at: string,
  context: Context,
  general: Namespace,
  lookUpAreas: AreaLookup
): Post | null {
  const { issues } = context;
  if (!content.ok) return drop(at, content.problem, issues);
  const slugs = areaSlugs(content.frontMatter);
  if (typeof slugs === 'string') return drop(at, slugs, issues);
  const [city, town] = slugs;
  const areas: PostAreas | Reason = city === undefined ? [] : lookUpAreas(city, town);
  if (typeof areas === 'string') return drop(at, areas, issues);
  const unclaimed: Namespace = new Map();
  const namespace = areas.length === 0 ? general : unclaimed;
  return parsePost(asPanelPost(file, content), at, context, namespace, areas);
}

function areaSlugs(frontMatter: Fields): AreaSlugs | Reason {
  const city = frontMatter.city ?? null;
  const town = frontMatter.town ?? null;
  if (city === null) return town === null ? [] : 'town is set without a city';
  if (!isSlug(city)) return `invalid city ${JSON.stringify(city)}`;
  if (town === null) return [city];
  if (!isSlug(town)) return `invalid town ${JSON.stringify(town)}`;
  return [city, town];
}

function asPanelPost(file: PostFile, content: { frontMatter: Fields; body: string }): Fields {
  const { title, description, ...fields } = content.frontMatter;
  return { ...fields, slug: postFileSlug(file), seo: { title, description }, body: content.body };
}

function parseTaxonomy(value: Fields, at: string, issues: Issues): TermLookup {
  const terms = (parameter: Parameter) => {
    const list = LISTS[parameter];
    const byKey = new Map<string, Term>();
    listOf(value[list]).forEach((item, index) => {
      const itemAt = `${at}.${list}[${index}]`;
      if (!isFields(item)) return drop(itemAt, 'not an object', issues);
      if (!isText(item.key)) return drop(itemAt, 'missing key', issues);
      if (!isText(item.label)) return drop(itemAt, 'missing label', issues);
      if (byKey.has(item.key)) return drop(itemAt, `repeats "${item.key}"`, issues);
      byKey.set(item.key, { key: item.key, label: item.label });
    });
    return byKey;
  };
  const lists: Record<Parameter, ReadonlyMap<string, Term>> = {
    occasion: terms('occasion'),
    time: terms('time'),
    venue_type: terms('venue_type'),
    group_size: terms('group_size'),
    budget: terms('budget'),
  };
  return (parameter, key) => (typeof key === 'string' ? lists[parameter].get(key) : undefined);
}

function parseCity(
  value: unknown,
  at: string,
  context: Context,
  topLevel: Namespace,
  claims: RepoClaims
): { city: City; posts: Post[] } | null {
  const area = parseArea(value, at, context, topLevel, 'a city');
  if (!area || !isFields(value)) return null;
  const cityRef: AreaRef = { slug: area.slug, name: area.name };
  const children = claimedNamespace(claims, [area.slug]);
  const towns = new Map<string, Area>();
  const posts: Post[] = [];

  listOf(value.towns).forEach((townValue, index) => {
    const townAt = `${at}.towns[${index}]`;
    const town = parseArea(townValue, townAt, context, children, 'a town');
    if (!town || !isFields(townValue)) return;
    towns.set(town.slug, town);
    const townRef: AreaRef = { slug: town.slug, name: town.name };
    const townPosts = claimedNamespace(claims, [area.slug, town.slug]);
    posts.push(
      ...parsePosts(townValue.posts, `${townAt}.posts`, context, townPosts, [cityRef, townRef])
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
  const occasion = taxonomy('occasion', value.occasion);
  if (!occasion) return drop(at, `unknown occasion ${JSON.stringify(value.occasion)}`, issues);
  const parameters: Term[] = [];
  for (const parameter of OPTIONAL_PARAMETERS) {
    const key = value[parameter] ?? null;
    if (key === null) continue;
    const term = taxonomy(parameter, key);
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
    source: { kind: 'markdown', markdown: text(value.body), images: [cover, ...images] },
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
  if (!isUploadUrl(sourceUrl)) return drop(at, 'source_url is not a Wikimedia JPEG upload', issues);
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

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
