import { buildPageTitle } from '@/lib/seo/metadata';
import { PLACES_LINE } from './body';
import type { Area, Catalog, CuratedPlace, Post } from './catalog';
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
import { GRANDFATHERED, type Grandfathered, type NamesByKey } from './grandfathered';
import { GETTING_AROUND, parseCatalog, type RepoContent } from './parse';
import type { CommonsImage } from './photos';
import { howToWords, titleEcho, wordSimilarity } from './repetition';

export type Rule = 'fields' | PostRule | PlaceRule | 'how-to-similarity' | SharedRule;

type SharedRule = 'occasion-per-city' | 'place-reuse' | 'photo-reuse';

type PostRule =
  | 'word-count'
  | 'places'
  | 'note-source'
  | 'note-openings'
  | 'images'
  | 'image-size'
  | 'alt-text'
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
  | 'alt-text'
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
  /** The files allowed past a sharing limit. Defaults to those that were past it when it came in. */
  grandfathered?: Grandfathered;
}

interface RuleContext extends CheckOptions {
  keywords: ReadonlySet<string>;
}

type Check<P> = (parsed: P, context: RuleContext) => Messages;

interface ContentKind<P, R extends Rule> {
  dir: string;
  shape: (frontMatter: Fields, file: ContentFile) => string[];
  kept: (file: ContentFile, catalog: Catalog) => P | null;
  rules: { [_ in R]: Check<P> };
}

const SEO_TITLE_MAX = 60;
const DESCRIPTION_RANGE = [120, 155] as const;
const BODY_WORDS = { general: [700, 1000], local: [400, 800] } as const;
const PLACES_MIN = 6;
const PLACE_NOTE_MIN_WORDS = 12;
const NOTE_OPENING_MAX = 2;
const IMAGES_MIN = 3;
/** The site caches a photo only up to this many bytes. */
const IMAGE_BYTES_MAX = 2_000_000;
const ALT_MAX = 125;
const POSTS_PER_PLACE_MAX = 3;
const HEADINGS = ['## How to do it in Where2Meet', '## Common questions'];
const INTRO_MIN_WORDS = 60;
const TRANSIT_NOTES_MIN_WORDS = 20;
/** Above this word-sequence ratio, two posts' How-to sections are near-copies. */
const HOW_TO_SIMILARITY_MAX = 0.6;

/** Python's `\w`: a Unicode letter, digit or underscore. */
const WORD_CHAR = String.raw`[\p{L}\p{N}_]`;
/** Brand wording: "convenient", never "fair" (or fairly, fairness) or "meet in the middle". */
const OFF_BRAND = new RegExp(
  String.raw`(?<!${WORD_CHAR})fair${WORD_CHAR}*|(?<!${WORD_CHAR})meet(?:s|ing)?(?:${SPACE}|-)+in(?:${SPACE}|-)+the(?:${SPACE}|-)+middle(?!${WORD_CHAR})`,
  'giu'
);
const NEAR_ME = new RegExp(String.raw`(?<!${WORD_CHAR})near${SPACE}+me(?!${WORD_CHAR})`, 'giu');
const GOOGLE_NAME = String.raw`google(?:${SPACE}+maps)?`;
const GOOGLE_TAG = String.raw`(?:per|according${SPACE}+to)${SPACE}+${GOOGLE_NAME}|${GOOGLE_NAME}${SPACE}+(?:lists|listed|says|said|shows|showed|rates|rated)|on${SPACE}+google${SPACE}+maps`;
const GOOGLE_SOURCE = new RegExp(
  String.raw`(?<!${WORD_CHAR})(?:${GOOGLE_TAG}|${GOOGLE_NAME})(?!${WORD_CHAR})`,
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
const POST_RULES: { [R in PostRule]: Check<Post> } = {
  'word-count': ({ areas, markdown }) => {
    const kind = areas.length === 0 ? 'general' : 'local';
    const [min, max] = BODY_WORDS[kind];
    const words = wordCount(markdown);
    return [
      !within(words, min, max) &&
        `the body has ${count(words, 'word')}; a ${kind} post needs ${n(min)} to ${n(max)}`,
    ];
  },

  places: ({ places }) => [
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

  'note-source': ({ places }) =>
    found(GOOGLE_SOURCE, noteText(places)).map(
      ({ field, phrase }) =>
        `${field} says "${phrase}"; state the fact plainly and name the source once in the body, or if Google is a landmark here, name it another way, as in "near the Chelsea Market building"`
    ),

  'note-openings': ({ places }) => {
    const groups = new Map<string, { label: string; word: string }[]>();
    for (const { label, note } of places) {
      const word = asRead(note).match(WORD)?.[0];
      if (word === undefined) continue;
      const lower = word.toLowerCase();
      const first = lower === 'an' ? 'a' : lower;
      groups.set(first, [...(groups.get(first) ?? []), { label, word }]);
    }
    return [...groups.values()].map(
      (notes) =>
        notes.length > NOTE_OPENING_MAX &&
        `the notes for ${sentenceList(notes.map(({ label }) => `"${label}"`))} all start with ${[...new Set(notes.map(({ word }) => `"${word}"`))].join(' or ')}; at most ${NOTE_OPENING_MAX} notes may share a first word, so open each one with why the place fits`
    );
  },

  images: ({ markdown, images }) => {
    const listed = new Set(images.map(({ fileName }) => fileName));
    const placed = new Set(
      lines(markdown).flatMap((line) => PHOTO_LINE.exec(line.trim())?.[1] ?? [])
    );
    return [
      images.length < IMAGES_MIN &&
        `the post has ${count(images.length, 'usable image')}; it needs at least ${IMAGES_MIN}, a cover and two for the body`,
      ...[...placed]
        .filter((name) => !listed.has(name))
        .map((name) => `the body places ![](${name}), but no usable image has that file_name`),
    ];
  },

  'image-size': ({ images }, { heads }) => sizeProblems(images, heads),

  'alt-text': ({ images }) => altProblems(images),

  title: ({ title }) => titleProblems(title),

  description: ({ title, description }) => descriptionProblems(title, description),

  'main-keyword': ({ title, mainKeyword, markdown }, { keywords }) => {
    if (mainKeyword === null) return [];
    const titleWords = withoutNearMe(mainKeyword);
    return [
      !keywords.has(normalize(mainKeyword)) &&
        `the main keyword "${mainKeyword}" is not a phrase in ${KEYWORDS_FILE}; it must be one, so add it there or pick one of its phrases`,
      titleWords === null &&
        !says(title, mainKeyword) &&
        `the title does not say the main keyword "${mainKeyword}"; it must, as whole words`,
      titleWords !== null &&
        !titleWords.every((word) => says(title, word)) &&
        `the title does not say each word of the main keyword "${mainKeyword}" other than "near me"; it must, as whole words, with the place instead of "near me"`,
      !says(opening(markdown), mainKeyword) &&
        `the body's first two sentences do not say the main keyword "${mainKeyword}"; they must, as whole words`,
    ];
  },

  headings: ({ markdown }) => {
    const present = headings(markdown);
    return HEADINGS.filter((heading) => !present.has(heading)).map(
      (heading) => `the body has no "${heading}" heading; every post needs it`
    );
  },

  wording: (post) => wordingProblems(postText(post)),

  style: (post) => styleProblems(postText(post)),

  dates: ({ publishedAt, updatedAt }) => [
    updatedAt < publishedAt &&
      `updated_at ${updatedAt} is before published_at ${publishedAt}; it must be on or after it`,
  ],
};

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

  'alt-text': (area) => altProblems(area.image ? [area.image] : []),

  title: (area) => titleProblems(area.seo.title),

  description: ({ seo }) => descriptionProblems(seo.title, seo.description),

  wording: (area) => wordingProblems(placeText(area)),

  style: (area) => styleProblems(placeText(area)),
};

const POSTS: ContentKind<Post, PostRule> = {
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
  const posts = repo.posts.flatMap((file) => {
    const post = keptPost(file, catalog);
    return post ? [{ file: filePath(POSTS_DIR, file.name), post }] : [];
  });
  const placeImages = repo.places.flatMap((file) => {
    const image = keptPlace(file, catalog)?.image;
    return image ? [{ file: filePath(PLACES_DIR, file.name), image }] : [];
  });
  return [
    ...problems(TAXONOMY_FILE, 'fields', skipped(TAXONOMY_FILE)),
    ...problems(KEYWORDS_FILE, 'fields', skipped(KEYWORDS_FILE)),
    ...repo.places.flatMap(checkFile(PLACES)),
    ...repo.posts.flatMap(checkFile(POSTS)),
    ...howToRepeats(posts.map(({ file, post }) => ({ file, words: howToWords(post.markdown) }))),
    ...sharingProblems(posts, placeImages, options.grandfathered ?? GRANDFATHERED),
  ];
}

/** Something only a few files may share, such as one place, as one file uses it. */
interface Use {
  file: string;
  /** What the limit counts, such as a place_id. */
  key: string;
  /** How the grandfathered lists name this use: a post's slug or an image's file_name. */
  name: string;
}

interface Limit<U extends Use> {
  rule: SharedRule;
  max: number;
  grandfathered: NamesByKey;
  message: (use: U, others: readonly U[]) => string;
}

function sharingProblems(
  posts: readonly { file: string; post: Post }[],
  placeImages: readonly { file: string; image: CommonsImage }[],
  grandfathered: Grandfathered
): Problem[] {
  const occasions = posts.flatMap(({ file, post }) => {
    const [city] = post.areas;
    return city
      ? [
          {
            file,
            key: `${city.slug}/${post.occasion.key}`,
            name: post.slug,
            city: city.name,
            occasion: post.occasion.key,
          },
        ]
      : [];
  });
  const places = posts.flatMap(({ file, post }) =>
    post.places.map(({ placeId, label }) => ({ file, key: placeId, name: post.slug, label }))
  );
  const photos = [
    ...placeImages,
    ...posts.flatMap(({ file, post }) => post.images.map((image) => ({ file, image }))),
  ].map(({ file, image }) => ({ file, key: image.sourceUrl, name: image.fileName }));
  return [
    ...pastLimit(occasions, {
      rule: 'occasion-per-city',
      max: 1,
      grandfathered: grandfathered.occasions,
      message: ({ city, occasion }, others) =>
        `${city} already has a post for the occasion "${occasion}": ${sentenceList(others.map(({ name }) => name))}; a city gets one post per occasion, at city level or in a town, so improve the post that was there first, and write a new post for an occasion ${city} has no post for, or for a city with no post for this occasion`,
    }),
    ...pastLimit(places, {
      rule: 'place-reuse',
      max: POSTS_PER_PLACE_MAX,
      grandfathered: grandfathered.places,
      message: ({ label, key }, others) =>
        `"${label}" (${key}) is in ${count(others.length, 'other post')}; a place may be in at most ${POSTS_PER_PLACE_MAX} posts, so pick a different place for the post that added it`,
    }),
    ...pastLimit(photos, {
      rule: 'photo-reuse',
      max: 1,
      grandfathered: grandfathered.photos,
      message: ({ name }, others) =>
        `${name}: its source_url is also ${sentenceList(others.map((other) => `${other.name} in ${other.file}`))}; one Commons photo gets one file_name, so pick a different photo for the file that added it`,
    }),
  ];
}

/** Every use of a key past its limit, except the grandfathered ones. No date says which use came first. */
function pastLimit<U extends Use>(uses: readonly U[], limit: Limit<U>): Problem[] {
  const byKey = new Map<string, U[]>();
  for (const use of uses) byKey.set(use.key, [...(byKey.get(use.key) ?? []), use]);
  return [...byKey].flatMap(([key, shared]) => {
    if (shared.length <= limit.max) return [];
    const kept = new Set(limit.grandfathered[key] ?? []);
    return shared
      .filter(({ name }) => !kept.has(name))
      .map((use) => ({
        file: use.file,
        rule: limit.rule,
        message: limit.message(
          use,
          shared.filter((other) => other !== use)
        ),
      }));
  });
}

/** Each pair of posts whose How-to sections are near-copies, reported on both files. */
function howToRepeats(sections: readonly { file: string; words: string[] }[]): Problem[] {
  const written = sections.filter(({ words }) => words.length > 0);
  const repeat = (file: string, other: string, share: number): Problem => ({
    file,
    rule: 'how-to-similarity',
    message: `the "How to do it in Where2Meet" section is ${percent(share)} percent the same as the one in ${other}, word by word; it may be at most ${percent(HOW_TO_SIMILARITY_MAX)} percent the same, so write it for this post's occasion and places`,
  });
  return written.flatMap((a, index) =>
    written.slice(index + 1).flatMap((b) => {
      const share = wordSimilarity(a.words, b.words);
      return share > HOW_TO_SIMILARITY_MAX
        ? [repeat(a.file, b.file, share), repeat(b.file, a.file, share)]
        : [];
    })
  );
}

export function formatProblem({ file, rule, message }: Problem): string {
  return `${file}: ${rule}: ${message}`;
}

function problems(file: string, rule: Rule, messages: Messages): Problem[] {
  return messages.flatMap((message) => (message ? [{ file, rule, message }] : []));
}

function keptPost(file: ContentFile, catalog: Catalog): Post | null {
  const [slug] = fileSegments(file.name);
  return catalog.posts.find((post) => post.slug === slug) ?? null;
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
    withoutNearMe(title) !== null &&
      `the title says "near me"; name the place instead, as in "Free indoor basketball courts near Back Bay"`,
  ];
}

/** The words of a phrase other than "near me", or null when it doesn't say "near me". */
function withoutNearMe(phrase: string): string[] | null {
  const rest = normalize(phrase).replace(NEAR_ME, ' ');
  return rest === normalize(phrase) ? null : rest.split(' ').filter(Boolean);
}

function altProblems(images: readonly CommonsImage[]): Messages {
  return images.map(({ fileName, alt }) => {
    const length = codePoints(alt);
    return (
      length > ALT_MAX &&
      `${fileName}: the alt text is ${count(length, 'character')}; it may be at most ${ALT_MAX}, so describe only what the photo shows and where`
    );
  });
}

function descriptionProblems(title: string, description: string): Messages {
  const length = codePoints(description);
  const [min, max] = DESCRIPTION_RANGE;
  const echo = titleEcho(title, description);
  return [
    !within(length, min, max) &&
      `the description is ${count(length, 'character')}; it needs ${min} to ${max}`,
    echo !== null &&
      `the description opens with "${echo}" from the title; open with what the reader gets, because search results show the title right above it`,
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

type PublishedText = [field: string, text: string][];

function postText(post: Post): PublishedText {
  return [
    ['the title', post.title],
    ['the description', post.description],
    ['the body', post.markdown],
    ...noteText(post.places),
    ...imageText(post.images),
  ];
}

function noteText(places: readonly CuratedPlace[]): PublishedText {
  return places.map(({ label, note }): [string, string] => [`the note for "${label}"`, note]);
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

function percent(share: number): number {
  return Math.round(share * 100);
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
