import { buildPageTitle } from '@/lib/seo/metadata';
import { PLACES_LINE } from './body';
import type { Area, Catalog, Post } from './catalog';
import {
  KEYWORDS_FILE,
  PLACES_DIR,
  POSTS_DIR,
  SPACE,
  TAXONOMY_FILE,
  filePath,
  fileSegments,
  isFields,
  isText,
  listOf,
  normalize,
  readFrontMatter,
  type ContentFile,
  type Fields,
} from './content-file';
import { GETTING_AROUND, parseCatalog, type RepoContent } from './parse';
import type { CommonsImage } from './photos';

/**
 * The checks CI runs on the repo's content. Every file gets `fields`. Each post the site keeps
 * gets the panel's publish checklist (nomi-control `where2meet/publishing.py`), ported rule for
 * rule, and each city and town the site keeps gets the place rules.
 */
export type Rule = 'fields' | PostRule | PlaceRule;

type PostRule =
  | 'word-count'
  | 'places'
  | 'images'
  | 'image-size'
  | 'title'
  | 'description'
  | 'main-keyword'
  | 'headings'
  | 'wording'
  | 'style'
  | 'dates';

type PlaceRule =
  | 'intro'
  | 'getting-around'
  | 'image'
  | 'image-size'
  | 'title'
  | 'description'
  | 'wording'
  | 'style';

export interface Problem {
  file: string;
  rule: Rule;
  message: string;
}

export interface ImageHead {
  status: number;
  bytes: number | null;
  contentType: string | null;
}

export interface CheckOptions {
  /** Keyed by source_url. An image without an entry was not measured, and its size goes unchecked. */
  heads: ReadonlyMap<string, ImageHead>;
}

interface ParsedPost {
  post: Post;
  body: string;
  images: readonly CommonsImage[];
}

interface RuleContext extends CheckOptions {
  /** The phrases in `keywords.yaml`, normalized as a main keyword matches one. */
  keywords: ReadonlySet<string>;
}

type Check<P> = (parsed: P, context: RuleContext) => Messages;

/** One folder of Markdown files: the fields each may have, and the rules for one the site keeps. */
interface ContentKind<P, R extends Rule> {
  dir: string;
  shape: (frontMatter: Fields, file: ContentFile) => string[];
  kept: (file: ContentFile, catalog: Catalog) => P | null;
  rules: { [_ in R]: Check<P> };
}

const SEO_TITLE_MAX = 60;
const DESCRIPTION_RANGE = [120, 155] as const;
const BODY_WORDS = { general: [700, 1000], local: [400, 800] } as const;
const PLACES_MIN = 3;
const PLACE_NOTE_MIN_WORDS = 12;
const IMAGES_MIN = 3;
/** The site caches a photo only up to this many bytes. */
const IMAGE_BYTES_MAX = 2_000_000;
const HEADINGS = ['## How to do it in Where2Meet', '## Common questions'];
const INTRO_MIN_WORDS = 60;
const TRANSIT_NOTES_MIN_WORDS = 20;

/** Python's `\w`: a Unicode letter, digit or underscore. */
const WORD_CHAR = String.raw`[\p{L}\p{N}_]`;
/** Brand wording: "convenient", never "fair" (or fairly, fairness) or "meet in the middle". */
const OFF_BRAND = new RegExp(
  String.raw`(?<!${WORD_CHAR})fair${WORD_CHAR}*|(?<!${WORD_CHAR})meet(?:s|ing)?(?:${SPACE}|-)+in(?:${SPACE}|-)+the(?:${SPACE}|-)+middle(?!${WORD_CHAR})`,
  'giu'
);
const STYLE_MARKS: Record<string, string> = {
  '\u2014': 'an em dash; use a period or a comma',
  '\u2013': 'an en dash; use a period or a comma',
  '\u2018': 'a curly quote; use straight quotes',
  '\u2019': 'a curly quote; use straight quotes',
  '\u201c': 'a curly quote; use straight quotes',
  '\u201d': 'a curly quote; use straight quotes',
};
const STYLE_MARK = new RegExp(`[${Object.keys(STYLE_MARKS).join('')}]`, 'gu');
/** Python's `str.splitlines` boundaries. */
const LINE_BREAK = /\r\n|[\n\v\f\r\x1c-\x1e\x85\u2028\u2029]/;
const LINK = /\[([^\]]*)\]\([^)]*\)/g;
const LINK_TARGET = /\]\([^)]*\)/g;
const EMPHASIS = /[*_]/g;
const WORD = /[\p{L}\p{N}]+(?:['\u2019][\p{L}\p{N}]+)*/gu;
const SENTENCE_END = new RegExp(`[.?!](?=${SPACE}|$)`, 'gu');
const EDGE_SPACE = new RegExp(`^${SPACE}+|${SPACE}+$`, 'gu');
const IMAGE_TOKEN = /^!\[\]\([^()\s]+\)$/;
const PHOTO_LINE = /^!\[[^\]]*\]\(([^)]*)\)$/;

/** How a field the parser reads leniently must look, so a wrong type can't pass unseen. */
interface FieldType {
  wants: string;
  test: (value: unknown) => boolean;
}

const PARSED = null;
const NON_EMPTY_TEXT: FieldType = { wants: 'non-empty text', test: isText };
const TEXT: FieldType = {
  wants: 'text',
  test: (value) => value === undefined || typeof value === 'string',
};
const LIST: FieldType = {
  wants: 'a list',
  test: (value) => value === undefined || Array.isArray(value),
};
const FLAG: FieldType = {
  wants: 'true or false',
  test: (value) => value === undefined || typeof value === 'boolean',
};

type Schema = Record<string, FieldType | null>;

/** The fields of the format's example, and no others: the site derives `license_url`. */
const POST_FIELDS: Schema = {
  title: NON_EMPTY_TEXT,
  description: NON_EMPTY_TEXT,
  main_keyword: NON_EMPTY_TEXT,
  occasion: PARSED,
  time: PARSED,
  venue_type: PARSED,
  group_size: PARSED,
  budget: PARSED,
  city: PARSED,
  town: PARSED,
  published_at: PARSED,
  updated_at: PARSED,
  places: LIST,
  images: LIST,
};
const CURATED_PLACE_FIELDS: Schema = { place_id: PARSED, label: PARSED, note: TEXT };
const IMAGE_FIELDS: Schema = {
  file_name: PARSED,
  source_url: PARSED,
  page_url: PARSED,
  width: PARSED,
  height: PARSED,
  alt: PARSED,
  caption: TEXT,
  author: PARSED,
  license: PARSED,
  cropped: FLAG,
};
const TOWN_FIELDS: Schema = {
  name: PARSED,
  center: PARSED,
  updated_at: PARSED,
  seo: PARSED,
  image: PARSED,
};
const CITY_FIELDS: Schema = { name: PARSED, region: PARSED, country: PARSED, ...TOWN_FIELDS };

type Messages = (string | false)[];

/** Rules for a post the site keeps. */
const POST_RULES: { [R in PostRule]: Check<ParsedPost> } = {
  'word-count': ({ post, body }) => {
    const kind = post.areas.length === 0 ? 'general' : 'local';
    const [min, max] = BODY_WORDS[kind];
    const words = wordCount(body);
    return [
      !within(words, min, max) &&
        `the body has ${count(words, 'word')}; a ${kind} post needs ${n(min)} to ${n(max)}`,
    ];
  },

  places: ({ post: { places } }) => [
    places.length < PLACES_MIN &&
      `the post has ${count(places.length, 'place')}; it needs at least ${PLACES_MIN}`,
    ...places.map(({ label, note }) => {
      const words = wordCount(note);
      return (
        words < PLACE_NOTE_MIN_WORDS &&
        `the note for "${label}" has ${count(words, 'word')}; a place note needs at least ${PLACE_NOTE_MIN_WORDS}`
      );
    }),
  ],

  images: ({ body, images }) => {
    const listed = new Set(images.map(({ fileName }) => fileName));
    const placed = new Set(lines(body).flatMap((line) => PHOTO_LINE.exec(line.trim())?.[1] ?? []));
    return [
      images.length < IMAGES_MIN &&
        `the post has ${count(images.length, 'usable image')}; it needs at least ${IMAGES_MIN}, a cover and two for the body`,
      ...[...placed]
        .filter((name) => !listed.has(name))
        .map((name) => `the body places ![](${name}), but no usable image has that file_name`),
    ];
  },

  'image-size': ({ images }, { heads }) => sizeProblems(images, heads),

  title: ({ post }) => titleProblems(post.title),

  description: ({ post }) => descriptionProblems(post.description),

  'main-keyword': ({ post: { title, mainKeyword }, body }, { keywords }) => {
    if (mainKeyword === null) return [];
    return [
      !keywords.has(normalize(mainKeyword)) &&
        `the main keyword "${mainKeyword}" is not a phrase in ${KEYWORDS_FILE}; it must be one, so add it there or pick one of its phrases`,
      !says(title, mainKeyword) &&
        `the title does not say the main keyword "${mainKeyword}"; it must, as whole words`,
      !says(opening(body), mainKeyword) &&
        `the body's first two sentences do not say the main keyword "${mainKeyword}"; they must, as whole words`,
    ];
  },

  headings: ({ body }) => {
    const present = headings(body);
    return HEADINGS.filter((heading) => !present.has(heading)).map(
      (heading) => `the body has no "${heading}" heading; every post needs it`
    );
  },

  wording: (parsed) => wordingProblems(postText(parsed)),

  style: (parsed) => styleProblems(postText(parsed)),

  dates: ({ post: { publishedAt, updatedAt } }) => [
    updatedAt < publishedAt &&
      `updated_at ${updatedAt} is before published_at ${publishedAt}; it must be on or after it`,
  ],
};

/** Rules for a city or town page the site keeps. */
const PLACE_RULES: { [R in PlaceRule]: Check<Area> } = {
  intro: (area) => {
    const words = wordCount(area.intro);
    return [
      words < INTRO_MIN_WORDS &&
        `the intro has ${count(words, 'word')}; a place page needs at least ${INTRO_MIN_WORDS}`,
    ];
  },

  'getting-around': ({ transitNotes }) => {
    if (transitNotes === null) {
      return [
        `the body has no "${GETTING_AROUND}" heading; a place page needs it before its transit notes`,
      ];
    }
    const words = wordCount(transitNotes);
    return [
      words < TRANSIT_NOTES_MIN_WORDS &&
        `the transit notes have ${count(words, 'word')}; they need at least ${TRANSIT_NOTES_MIN_WORDS}`,
    ];
  },

  image: (area) => [!area.image && 'the page has no usable image; a place page needs one'],

  'image-size': (area, { heads }) => sizeProblems(area.image ? [area.image] : [], heads),

  title: (area) => titleProblems(area.seo.title),

  description: (area) => descriptionProblems(area.seo.description),

  wording: (area) => wordingProblems(placeText(area)),

  style: (area) => styleProblems(placeText(area)),
};

const POSTS: ContentKind<ParsedPost, PostRule> = {
  dir: POSTS_DIR,
  shape: postFieldProblems,
  kept: keptPost,
  rules: POST_RULES,
};

const PLACES: ContentKind<Area, PlaceRule> = {
  dir: PLACES_DIR,
  shape: placeFieldProblems,
  kept: keptPlace,
  rules: PLACE_RULES,
};

/**
 * Every problem in the repo's content, per file: `fields` holds why the site skips the file or
 * part of it, and a post or place the site keeps gets the rest in rule order.
 */
export function checkContent(repo: RepoContent, options: CheckOptions): Problem[] {
  const { catalog, issues } = parseCatalog(repo);
  const context: RuleContext = {
    ...options,
    keywords: new Set(catalog.keywords.map(({ phrase }) => normalize(phrase))),
  };
  const skipped = (file: string) =>
    issues.filter((issue) => issue.file === file).map(({ message }) => message);
  const checkFile =
    <P, R extends Rule>(kind: ContentKind<P, R>) =>
    (file: ContentFile): Problem[] => {
      const path = filePath(kind.dir, file.name);
      const content = readFrontMatter(file.text);
      if (!content.ok) return problems(path, 'fields', skipped(path));
      const parsed = kind.kept(file, catalog);
      return [
        ...problems(path, 'fields', [...skipped(path), ...kind.shape(content.frontMatter, file)]),
        ...(parsed
          ? entries(kind.rules).flatMap(([rule, check]) =>
              problems(path, rule, check(parsed, context))
            )
          : []),
      ];
    };
  return [
    ...problems(TAXONOMY_FILE, 'fields', skipped(TAXONOMY_FILE)),
    ...problems(KEYWORDS_FILE, 'fields', skipped(KEYWORDS_FILE)),
    ...repo.places.flatMap(checkFile(PLACES)),
    ...repo.posts.flatMap(checkFile(POSTS)),
  ];
}

export function formatProblem({ file, rule, message }: Problem): string {
  return `${file}: ${rule}: ${message}`;
}

function problems(file: string, rule: Rule, messages: Messages): Problem[] {
  return messages.flatMap((message) => (message ? [{ file, rule, message }] : []));
}

function keptPost(file: ContentFile, catalog: Catalog): ParsedPost | null {
  const [slug] = fileSegments(file.name);
  for (const post of catalog.posts) {
    if (post.source.kind !== 'markdown' || post.slug !== slug) continue;
    const { markdown, images } = post.source;
    return { post, body: markdown, images };
  }
  return null;
}

function keptPlace(file: ContentFile, catalog: Catalog): Area | null {
  const [citySlug, townSlug, ...deeper] = fileSegments(file.name);
  if (deeper.length > 0) return null;
  const city = catalog.cities.get(citySlug);
  return (townSlug === undefined ? city : city?.towns.get(townSlug)) ?? null;
}

function postFieldProblems(frontMatter: Fields): string[] {
  const nested = (name: string, schema: Schema, noun: string) =>
    listOf(frontMatter[name]).flatMap((item, index) =>
      isFields(item) ? shapeProblems(item, schema, noun, `${name}[${index}]`) : []
    );
  return [
    ...shapeProblems(frontMatter, POST_FIELDS, 'a post'),
    ...nested('places', CURATED_PLACE_FIELDS, 'a place'),
    ...nested('images', IMAGE_FIELDS, 'an image'),
  ];
}

function placeFieldProblems(frontMatter: Fields, file: ContentFile): string[] {
  const depth = fileSegments(file.name).length;
  if (depth > 2) return [];
  const { image } = frontMatter;
  return [
    ...(depth === 1
      ? shapeProblems(frontMatter, CITY_FIELDS, 'a city')
      : shapeProblems(frontMatter, TOWN_FIELDS, 'a town')),
    ...(isFields(image) ? shapeProblems(image, IMAGE_FIELDS, 'an image', 'image') : []),
  ];
}

function shapeProblems(fields: Fields, schema: Schema, noun: string, at?: string): string[] {
  const prefix = at ? `${at}: ` : '';
  const unknown = Object.keys(fields)
    .filter((name) => !Object.hasOwn(schema, name))
    .map(
      (name) =>
        `${prefix}unknown field "${name}"; ${noun} has only ${sentenceList(Object.keys(schema))}`
    );
  const mistyped = Object.entries(schema).flatMap(([name, type]) =>
    type && !type.test(fields[name])
      ? [`${prefix}${name} is ${described(fields[name])}; it must be ${type.wants}`]
      : []
  );
  return [...unknown, ...mistyped];
}

function titleProblems(title: string): Messages {
  const length = codePoints(buildPageTitle(title));
  return [
    length > SEO_TITLE_MAX &&
      `the title is ${count(length, 'character')} with its " | Where2Meet" suffix; it needs at most ${SEO_TITLE_MAX}`,
  ];
}

function descriptionProblems(description: string): Messages {
  const length = codePoints(description);
  const [min, max] = DESCRIPTION_RANGE;
  return [
    !within(length, min, max) &&
      `the description is ${count(length, 'character')}; it needs ${min} to ${max}`,
  ];
}

function sizeProblems(
  images: readonly CommonsImage[],
  heads: ReadonlyMap<string, ImageHead>
): Messages {
  return images.flatMap(({ fileName, sourceUrl }) => {
    const head = heads.get(sourceUrl);
    return head ? headProblems(fileName, head) : [];
  });
}

function headProblems(fileName: string, { status, bytes, contentType }: ImageHead): Messages {
  if (status < 200 || status > 299) {
    return [`${fileName}: its source_url answered HTTP ${status}; it needs to load`];
  }
  const type = contentType?.split(';')[0].trim().toLowerCase() || null;
  return [
    type !== 'image/jpeg' &&
      `${fileName}: its source_url serves ${type ?? 'no content type'}; it needs image/jpeg`,
    bytes === null &&
      `${fileName}: its source_url gives no size; the site caches only a photo it knows is at most ${n(IMAGE_BYTES_MAX)} bytes`,
    bytes !== null &&
      bytes > IMAGE_BYTES_MAX &&
      `${fileName}: its source_url serves ${n(bytes)} bytes; the site caches a photo only up to ${n(IMAGE_BYTES_MAX)}`,
  ];
}

/** The free text the site renders, by where it shows. */
type PublishedText = [field: string, text: string][];

/** Labels and author names are proper nouns, not copy. */
function postText({ post, body, images }: ParsedPost): PublishedText {
  return [
    ['the title', post.title],
    ['the description', post.description],
    ['the body', body],
    ...post.places.map(({ label, note }): [string, string] => [`the note for "${label}"`, note]),
    ...imageText(images),
  ];
}

function placeText(area: Area): PublishedText {
  return [
    ['the title', area.seo.title],
    ['the description', area.seo.description],
    ['the intro', area.intro],
    ['the Getting around section', area.transitNotes ?? ''],
    ...imageText(area.image ? [area.image] : []),
  ];
}

function imageText(images: readonly CommonsImage[]): PublishedText {
  return images.flatMap(
    ({ fileName, alt, caption }): PublishedText => [
      [`the alt text of ${fileName}`, alt],
      [`the caption of ${fileName}`, caption],
    ]
  );
}

function wordingProblems(texts: PublishedText): Messages {
  return found(OFF_BRAND, texts).map(
    ({ field, phrase }) =>
      `${field} says "${phrase}"; write "convenient", and never a word starting with "fair" or "meet in the middle"`
  );
}

function styleProblems(texts: PublishedText): Messages {
  return found(STYLE_MARK, texts).map(
    ({ field, phrase }) => `${field} has ${STYLE_MARKS[phrase]} instead of "${phrase}"`
  );
}

function found(pattern: RegExp, texts: PublishedText): { field: string; phrase: string }[] {
  return texts.flatMap(([field, text]) =>
    [...new Set([...asRead(text).matchAll(pattern)].map(([phrase]) => phrase))].map((phrase) => ({
      field,
      phrase,
    }))
  );
}

/** Markdown as a reader sees it: a link as its text, emphasis without its marks. */
function asRead(text: string): string {
  return text.replace(LINK, '$1').replace(EMPHASIS, '');
}

function lines(text: string): string[] {
  return text.split(LINE_BREAK);
}

function isProse(line: string): boolean {
  return line !== '' && !line.startsWith('#') && line !== PLACES_LINE && !IMAGE_TOKEN.test(line);
}

/** The first two sentences a reader sees: headings, blank lines and token lines skipped. */
function opening(body: string): string {
  const text = asRead(
    lines(body)
      .map((line) => line.replace(EDGE_SPACE, ''))
      .filter(isProse)
      .join(' ')
  );
  const ends = [...text.matchAll(SENTENCE_END)].map((end) => end.index + end[0].length);
  return ends.length > 1 ? text.slice(0, ends[1]) : text;
}

function headings(body: string): Set<string> {
  return new Set(
    lines(body)
      .filter((line) => line.startsWith('## '))
      .map((line) => line.replace(EDGE_SPACE, ''))
  );
}

/** Words a reader sees: a Markdown link counts its text, not its URL. */
function wordCount(text: string): number {
  return text.replace(LINK_TARGET, '] ').match(WORD)?.length ?? 0;
}

function says(text: string, phrase: string): boolean {
  const needle = normalize(phrase);
  if (needle === '') return false;
  const escaped = needle.replace(/[\\^$.*+?()[\]{}|/]/g, '\\$&');
  return new RegExp(`(?<!${WORD_CHAR})${escaped}(?!${WORD_CHAR})`, 'u').test(normalize(text));
}

function entries<K extends string, V>(record: { [_ in K]: V }): [K, V][] {
  return Object.entries(record) as [K, V][];
}

function within(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/** Python's `len`: code points, not UTF-16 units. */
function codePoints(text: string): number {
  return [...text].length;
}

function n(value: number): string {
  return value.toLocaleString('en-US');
}

function count(value: number, noun: string): string {
  return `${n(value)} ${noun}${value === 1 ? '' : 's'}`;
}

function sentenceList(items: readonly string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

function described(value: unknown): string {
  return value === undefined ? 'missing' : JSON.stringify(value);
}
