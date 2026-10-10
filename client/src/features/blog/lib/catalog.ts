import type { IsoDate } from '@/lib/seo/site-pages';
import type { CommonsImage, Photo } from './photos';

export const BLOG_PATH = '/blog';
export const IMAGES_SEGMENT = 'images';

/** The parameters a post may set besides its occasion, in the order its chips show them. */
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

/** The parameter keys an occasion suggests, from `taxonomy.yaml`. */
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

/** A search phrase a post can target, from `keywords.yaml`. */
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
  /** Null when the body has no `## Getting around` line. */
  transitNotes: string | null;
  image: CommonsImage | null;
}

export interface City extends Area {
  region: string;
  country: string;
  towns: ReadonlyMap<string, Area>;
}

export type PostSource =
  | { kind: 'mdx'; cover: Photo }
  | { kind: 'markdown'; markdown: string; images: readonly [CommonsImage, ...CommonsImage[]] };

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
  /** The phrase from `keywords.yaml` the post targets. MDX posts have none. */
  mainKeyword: string | null;
  places: readonly CuratedPlace[];
  placesTitle: string;
  source: PostSource;
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

export function postChips(post: Post): Term[] {
  return [
    post.occasion,
    ...OPTIONAL_PARAMETERS.flatMap((parameter) => post.parameters[parameter] ?? []),
  ];
}

export function postCover(post: Post): Photo {
  return post.source.kind === 'mdx' ? post.source.cover : post.source.images[0];
}

export function postPhotos(post: Post): readonly Photo[] {
  return post.source.kind === 'mdx' ? [post.source.cover] : post.source.images;
}

export function pagePhotos(page: BlogPage): readonly Photo[] {
  if (page.kind === 'post') return postPhotos(page.post);
  const { image } = page.town ?? page.city;
  return image ? [image] : [];
}

export function pageUpdatedAt(page: BlogPage): IsoDate {
  return page.kind === 'post' ? page.post.updatedAt : (page.town ?? page.city).updatedAt;
}

export function latestUpdate(catalog: Catalog): IsoDate | undefined {
  return listPages(catalog).map(pageUpdatedAt).sort().at(-1);
}

export function catalogImages(catalog: Catalog): ReadonlyMap<string, CommonsImage> {
  const areas = [...catalog.cities.values()].flatMap((city) => [city, ...city.towns.values()]);
  const images = [
    ...catalog.posts.flatMap((post) => (post.source.kind === 'markdown' ? post.source.images : [])),
    ...areas.flatMap((area) => area.image ?? []),
  ];
  return new Map(images.map((image) => [image.fileName, image]));
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

export function relatedPosts(catalog: Catalog, post: Post, limit = 4): Post[] {
  // Places match from the city down, so two cities' "downtown" towns don't count as the same place.
  const sharedPlace = (other: Post) => {
    const firstDifference = post.areas.findIndex(
      (area, index) => other.areas[index]?.slug !== area.slug
    );
    return firstDifference === -1 ? post.areas.length : firstDifference;
  };
  const sameOccasion = (other: Post) => (other.occasion.key === post.occasion.key ? 1 : 0);
  return catalog.posts
    .filter((other) => other !== post)
    .toSorted(
      (a, b) =>
        sameOccasion(b) - sameOccasion(a) ||
        sharedPlace(b) - sharedPlace(a) ||
        b.publishedAt.localeCompare(a.publishedAt)
    )
    .slice(0, limit);
}
