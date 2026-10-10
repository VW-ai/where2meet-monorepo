import { buildPageTitle } from '@/lib/seo/metadata';
import { PLACES_LINE } from './body';
import type { Catalog, Post } from './catalog';
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
  type ContentFile,
  type Fields,
} from './content-file';
import { parseCatalog, type RepoContent } from './parse';
import type { CommonsImage } from './photos';

/**
 * The checks CI runs on the repo's content. Every file gets `fields`, and each post the site
 * keeps gets the panel's publish checklist (nomi-control `where2meet/publishing.py`), ported
 * rule for rule.
 */
export type Rule =
  | 'fields'
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

type PostRule = Exclude<Rule, 'fields'>;

interface Parsed {
  post: Post;
  body: string;
  images: readonly CommonsImage[];
  mainKeyword: unknown;
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

/** Python's `\w`: a Unicode letter, digit or underscore. */
const WORD_CHAR = String.raw`[\p{L}\p{N}_]`;
/** Python's `\s`, which also counts \x1c to \x1f and \x85 and leaves out \ufeff. */
const SPACE = String.raw`[\t-\r\x1c-\x20\x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]`;
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
const PLACE_FIELDS: Schema = { place_id: PARSED, label: PARSED, note: TEXT };
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

type Messages = (string | false)[];

/** Rules for a post the site keeps. */
const POST_RULES: { [R in PostRule]: (parsed: Parsed, options: CheckOptions) => Messages } = {
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

  'image-size': ({ images }, { heads }) =>
    images.flatMap(({ fileName, sourceUrl }) => {
      const head = heads.get(sourceUrl);
      return head ? sizeProblems(fileName, head) : [];
    }),

  title: ({ post }) => {
    const length = codePoints(buildPageTitle(post.title));
    return [
      length > SEO_TITLE_MAX &&
        `the title is ${count(length, 'character')} with its " | Where2Meet" suffix; it needs at most ${SEO_TITLE_MAX}`,
    ];
  },

  description: ({ post }) => {
    const length = codePoints(post.description);
    const [min, max] = DESCRIPTION_RANGE;
    return [
      !within(length, min, max) &&
        `the description is ${count(length, 'character')}; it needs ${min} to ${max}`,
    ];
  },

  'main-keyword': ({ post, body, mainKeyword }) => {
    if (!isText(mainKeyword)) return [];
    return [
      !says(post.title, mainKeyword) &&
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

  wording: (parsed) =>
    found(OFF_BRAND, parsed).map(
      ({ field, phrase }) =>
        `${field} says "${phrase}"; write "convenient", and never a word starting with "fair" or "meet in the middle"`
    ),

  style: (parsed) =>
    found(STYLE_MARK, parsed).map(
      ({ field, phrase }) => `${field} has ${STYLE_MARKS[phrase]} instead of "${phrase}"`
    ),

  dates: ({ post: { publishedAt, updatedAt } }) => [
    updatedAt < publishedAt &&
      `updated_at ${updatedAt} is before published_at ${publishedAt}; it must be on or after it`,
  ],
};

/**
 * Every problem in the repo's content, per file: `fields` holds why the site skips the file or
 * part of it, and a post the site keeps gets the rest in the order of `Rule`.
 */
export function checkContent(repo: RepoContent, options: CheckOptions): Problem[] {
  const { catalog, issues } = parseCatalog(repo);
  const skipped = (file: string) =>
    issues.filter((issue) => issue.file === file).map(({ message }) => message);
  return [
    ...problems(TAXONOMY_FILE, 'fields', skipped(TAXONOMY_FILE)),
    ...repo.places.flatMap((file) => {
      const path = filePath(PLACES_DIR, file.name);
      return problems(path, 'fields', skipped(path));
    }),
    ...repo.posts.flatMap((file) => {
      const path = filePath(POSTS_DIR, file.name);
      const content = readFrontMatter(file.text);
      if (!content.ok) return problems(path, 'fields', skipped(path));
      const parsed = keptPost(file, content.frontMatter, catalog);
      return [
        ...problems(path, 'fields', [...skipped(path), ...fieldProblems(content.frontMatter)]),
        ...(parsed
          ? entries(POST_RULES).flatMap(([rule, check]) =>
              problems(path, rule, check(parsed, options))
            )
          : []),
      ];
    }),
  ];
}

export function formatProblem({ file, rule, message }: Problem): string {
  return `${file}: ${rule}: ${message}`;
}

function problems(file: string, rule: Rule, messages: Messages): Problem[] {
  return messages.flatMap((message) => (message ? [{ file, rule, message }] : []));
}

function keptPost(file: ContentFile, frontMatter: Fields, catalog: Catalog): Parsed | null {
  const [slug] = fileSegments(file.name);
  for (const post of catalog.posts) {
    if (post.source.kind !== 'markdown' || post.slug !== slug) continue;
    const { markdown, images } = post.source;
    return { post, body: markdown, images, mainKeyword: frontMatter.main_keyword };
  }
  return null;
}

function fieldProblems(frontMatter: Fields): string[] {
  const nested = (name: string, schema: Schema, noun: string) =>
    listOf(frontMatter[name]).flatMap((item, index) =>
      isFields(item) ? shapeProblems(item, schema, noun, `${name}[${index}]`) : []
    );
  return [
    ...shapeProblems(frontMatter, POST_FIELDS, 'a post'),
    ...nested('places', PLACE_FIELDS, 'a place'),
    ...nested('images', IMAGE_FIELDS, 'an image'),
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

function sizeProblems(fileName: string, { status, bytes, contentType }: ImageHead): Messages {
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

/** The free text the site renders. Labels and author names are proper nouns, not copy. */
function publishedText({ post, body, images }: Parsed): [field: string, text: string][] {
  return [
    ['the title', post.title],
    ['the description', post.description],
    ['the body', body],
    ...post.places.map(({ label, note }): [string, string] => [`the note for "${label}"`, note]),
    ...images.flatMap(({ fileName, alt, caption }): [string, string][] => [
      [`the alt text of ${fileName}`, alt],
      [`the caption of ${fileName}`, caption],
    ]),
  ];
}

function found(pattern: RegExp, parsed: Parsed): { field: string; phrase: string }[] {
  return publishedText(parsed).flatMap(([field, text]) =>
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

/** Python's `casefold`, closely enough for matching: upper then lower also folds ß to ss. */
function normalize(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201a\u201b\u2032]/gu, "'")
    .replace(/[\u201c-\u201f\u2033]/gu, '"')
    .toUpperCase()
    .toLowerCase()
    .split(new RegExp(`${SPACE}+`, 'u'))
    .filter(Boolean)
    .join(' ');
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
