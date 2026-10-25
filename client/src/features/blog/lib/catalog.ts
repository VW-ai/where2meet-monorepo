import type { IsoDate } from '@/lib/seo/site-pages';
import type { CommonsImage } from './photos';

export const BLOG_PATH = '/blog';
export const BLOG_AUTHOR = 'The Where2Meet team';
export const IMAGES_SEGMENT = 'images';

export const OPTIONAL_PARAMETERS = ['time', 'venue_type', 'group_size', 'budget'] as const;
export type OptionalParameter = (typeof OPTIONAL_PARAMETERS)[number];

export interface Seo {
  title: string;
  description: string;
}

export interface Term {
  key: string;
  label: string;
}

export interface OccasionTerm extends Term {
  times: readonly string[];
  venueTypes: readonly string[];
  groupSizes: readonly string[];
}

export interface VenueTypeTerm extends Term {
  googleType: string;
}

export interface BudgetTerm extends Term {
  priceLevel: string;
}

export interface Keyword {
  phrase: string;
  occasion: string | null;
  note: string | null;
}

export interface Taxonomy {
  occasions: readonly OccasionTerm[];
  times: readonly Term[];
  venueTypes: readonly VenueTypeTerm[];
  groupSizes: readonly Term[];
  budgets: readonly BudgetTerm[];
}

export interface CuratedPlace {
  placeId: string;
  label: string;
  note: string;
}

export interface AreaRef {
  slug: string;
  name: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Area extends AreaRef {
  updatedAt: IsoDate;
  seo: Seo;
  center: LatLng;
  intro: string;
  transitNotes: string | null;
  image: CommonsImage | null;
}

export interface City extends Area {
  region: string;
  country: string;
  towns: ReadonlyMap<string, Area>;
}

export type PostAreas = readonly [] | readonly [AreaRef] | readonly [AreaRef, AreaRef];

export interface Post {
  slug: string;
  areas: PostAreas;
  title: string;
  description: string;
  publishedAt: IsoDate;
  updatedAt: IsoDate;
  occasion: Term;
  parameters: Readonly<Record<OptionalParameter, Term | null>>;
  mainKeyword: string | null;
  places: readonly CuratedPlace[];
  placesTitle: string;
  markdown: string;
  images: readonly [CommonsImage, ...CommonsImage[]];
}

export interface Catalog {
  taxonomy: Taxonomy;
  keywords: readonly Keyword[];
  posts: readonly Post[];
  cities: ReadonlyMap<string, City>;
}

export const NO_PARAMETERS: Post['parameters'] = {
  time: null,
  venue_type: null,
  group_size: null,
  budget: null,
};

export type AreaPage = { kind: 'area'; city: City; town: Area | null };
export type PostPage = { kind: 'post'; post: Post };
export type BlogPage = PostPage | AreaPage;

export interface Crumb {
  name: string;
  path: string;
}

export function imagePath(fileName: string): string {
  return `${BLOG_PATH}/${IMAGES_SEGMENT}/${fileName}`;
}

export function segmentsPath(segments: readonly string[]): string {
  return [BLOG_PATH, ...segments].join('/');
}

export function pageSegments(page: BlogPage): string[] {
  if (page.kind === 'post') return [...page.post.areas.map(({ slug }) => slug), page.post.slug];
  return [page.city.slug, ...(page.town ? [page.town.slug] : [])];
}

export function pagePath(page: BlogPage): string {
  return segmentsPath(pageSegments(page));
}

export function postPath(post: Post): string {
  return pagePath({ kind: 'post', post });
}

export function coverPath(page: BlogPage): string {
  return `${pagePath(page)}/cover.png`;
}

export function listPages(catalog: Catalog): BlogPage[] {
  return [
    ...catalog.posts.map((post): BlogPage => ({ kind: 'post', post })),
    ...[...catalog.cities.values()].flatMap((city): BlogPage[] => [
      { kind: 'area', city, town: null },
      ...[...city.towns.values()].map((town): BlogPage => ({ kind: 'area', city, town })),
    ]),
  ];
}

export function findPage(catalog: Catalog, segments: readonly string[]): BlogPage | null {
  const path = segmentsPath(segments);
  return listPages(catalog).find((page) => pagePath(page) === path) ?? null;
}

interface AreaPhrasing {
  preposition: 'in' | 'on';
  article: '' | 'the ';
}

const PLAIN_PHRASING: AreaPhrasing = { preposition: 'in', article: '' };

/** A name ending in one of these words takes "the", as in "on the Upper West Side" and "in the Financial District". */
const PHRASING_BY_HEAD_NOUN: Readonly<Record<string, AreaPhrasing>> = {
  Side: { preposition: 'on', article: 'the ' },
  District: { preposition: 'in', article: 'the ' },
};

function areaPhrasing({ name }: AreaRef): AreaPhrasing {
  const headNoun = name.split(' ').at(-1) ?? '';
  return Object.hasOwn(PHRASING_BY_HEAD_NOUN, headNoun)
    ? PHRASING_BY_HEAD_NOUN[headNoun]
    : PLAIN_PHRASING;
}

export function areaWithArticle(area: AreaRef): string {
  return `${areaPhrasing(area).article}${area.name}`;
}

export function inArea(area: AreaRef): string {
  return `${areaPhrasing(area).preposition} ${areaWithArticle(area)}`;
}

export function postChips(post: Post): Term[] {
  return [
    post.occasion,
    ...OPTIONAL_PARAMETERS.flatMap((parameter) => post.parameters[parameter] ?? []),
  ];
}

export function pagePhotos(page: BlogPage): readonly CommonsImage[] {
  if (page.kind === 'post') return page.post.images;
  const { image } = page.town ?? page.city;
  return image ? [image] : [];
}

export function pageCover(page: BlogPage): CommonsImage | null {
  return pagePhotos(page)[0] ?? null;
}

/**
 * A city or town page changes when a post it lists is published, so it dates by that too. It takes the
 * post's `publishedAt`, not its `updatedAt`, so an edit to a post doesn't re-date every page that lists it.
 */
export function pageUpdatedAt(catalog: Catalog, page: BlogPage): IsoDate {
  if (page.kind === 'post') return page.post.updatedAt;
  return [
    (page.town ?? page.city).updatedAt,
    ...areaPosts(catalog, page).map((post) => post.publishedAt),
  ]
    .sort()
    .at(-1)!;
}

export function latestUpdate(catalog: Catalog): IsoDate | undefined {
  return listPages(catalog)
    .map((page) => pageUpdatedAt(catalog, page))
    .sort()
    .at(-1);
}

export function catalogImages(catalog: Catalog): ReadonlyMap<string, CommonsImage> {
  return new Map(
    listPages(catalog)
      .flatMap(pagePhotos)
      .map((image) => [image.fileName, image])
  );
}

export function pageTrail(page: BlogPage): Crumb[] {
  const areas: AreaRef[] =
    page.kind === 'post' ? [...page.post.areas] : [page.city, ...(page.town ? [page.town] : [])];
  return [
    { name: 'Blog', path: BLOG_PATH },
    ...areas.map((area, index) => ({
      name: area.name,
      path: segmentsPath(areas.slice(0, index + 1).map(({ slug }) => slug)),
    })),
    ...(page.kind === 'post' ? [{ name: page.post.title, path: postPath(page.post) }] : []),
  ];
}

export function areaPosts(catalog: Catalog, { city, town }: AreaPage): Post[] {
  return catalog.posts.filter(
    ({ areas: [postCity, postTown] }) =>
      postCity?.slug === city.slug && (!town || postTown?.slug === town.slug)
  );
}

/** What a related post scores for each thing it shares with the post. An area scores once per shared level. */
const RELATED_POINTS = { occasion: 4, venueType: 2, areaLevel: 1 } as const;
const RELATED_POSTS = 4;

function relatedness(post: Post, other: Post): number {
  // Areas match from the city down, so two cities' "downtown" towns don't count as the same place.
  const firstDifference = post.areas.findIndex(
    (area, index) => other.areas[index]?.slug !== area.slug
  );
  const sharedLevels = firstDifference === -1 ? post.areas.length : firstDifference;
  const venueType = post.parameters.venue_type;
  return (
    (other.occasion.key === post.occasion.key ? RELATED_POINTS.occasion : 0) +
    (venueType && other.parameters.venue_type?.key === venueType.key
      ? RELATED_POINTS.venueType
      : 0) +
    sharedLevels * RELATED_POINTS.areaLevel
  );
}

/**
 * The posts that share the most with `post`, ties going to the next slug in alphabetical order after
 * `post`'s, wrapping around. The last slot always goes to the first post in that order that isn't
 * already chosen. So each post's alphabetical predecessor links it, and every post gets at least one link
 * however many posts share more with the others.
 */
export function relatedPosts(catalog: Catalog, post: Post): Post[] {
  const ring = catalog.posts.map(({ slug }) => slug).toSorted();
  const start = ring.indexOf(post.slug);
  const after = (other: Post) => (ring.indexOf(other.slug) - start + ring.length) % ring.length;
  const inRingOrder = catalog.posts
    .filter((other) => other !== post)
    .toSorted((a, b) => after(a) - after(b));
  const best = inRingOrder
    .map((other) => ({ other, points: relatedness(post, other) }))
    .toSorted((a, b) => b.points - a.points)
    .slice(0, RELATED_POSTS - 1)
    .map(({ other }) => other);
  const next = inRingOrder.find((other) => !best.includes(other));
  return next ? [...best, next] : best;
}
