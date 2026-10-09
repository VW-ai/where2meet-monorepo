import type { IsoDate } from '@/lib/seo/site-pages';
import type { CommonsImage, Photo } from './photos';

export const BLOG_PATH = '/blog';
/** The cache tag on the panel fetch, and the tag its revalidation webhook sends. */
export const PANEL_TAG = 'where2meet-guides';
/** `/blog/images/<file>` serves photos, so no post or city can have this slug. */
export const IMAGES_SEGMENT = 'images';

export interface Seo {
  title: string;
  description: string;
}

export interface Term {
  key: string;
  label: string;
}

/** A Google place an editor picked. `label` and `note` are the editor's words, never Google's. */
export interface CuratedPlace {
  placeId: string;
  label: string;
  note: string;
}

/** A city or a town, as the posts in it refer to it. */
export interface AreaRef {
  slug: string;
  name: string;
}

/** A city's or a town's page. Text fields hold Markdown in the contract's subset. */
export interface Area extends AreaRef {
  updatedAt: IsoDate;
  seo: Seo;
  intro: string;
  transitNotes: string;
  image: CommonsImage | null;
}

export interface City extends Area {
  region: string;
  /** Keyed by slug in the panel's order. */
  towns: ReadonlyMap<string, Area>;
}

export type PostSource =
  /** Written in the repo. Its body is `src/content/blog/<slug>.mdx`, widgets and all. */
  | { kind: 'repo'; cover: Photo }
  /** Published in the panel. `images[0]` is the cover. */
  | { kind: 'panel'; markdown: string; images: readonly [CommonsImage, ...CommonsImage[]] };

/** A general post has no areas. A local post has its city, then its town when it has one. */
export type PostAreas = readonly [] | readonly [AreaRef] | readonly [AreaRef, AreaRef];

export interface Post {
  slug: string;
  areas: PostAreas;
  title: string;
  description: string;
  publishedAt: IsoDate;
  updatedAt: IsoDate;
  occasion: Term;
  /** The optional parameters it sets, in the order time, venue type, group size, budget. */
  parameters: readonly Term[];
  places: readonly CuratedPlace[];
  placesTitle: string;
  source: PostSource;
}

/**
 * Everything under /blog. No two pages share a path: the parser drops a panel item
 * whose path a repo post, a city, a town or an earlier post already holds.
 */
export interface Catalog {
  /** Newest first. */
  posts: readonly Post[];
  /** Keyed by slug in the panel's order. */
  cities: ReadonlyMap<string, City>;
}

export type AreaPage = { kind: 'area'; city: City; town: Area | null };
export type PostPage = { kind: 'post'; post: Post };
/** A page below the index. */
export type BlogPage = PostPage | AreaPage;

export interface Crumb {
  name: string;
  path: string;
}

/** The repo's posts and the panel's content as one catalog, newest post first. */
export function withRepoPosts(repoPosts: readonly Post[], panel: Catalog): Catalog {
  const posts = [...repoPosts, ...panel.posts].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt)
  );
  return { posts, cities: panel.cities };
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

/** Each post newest first, then each city followed by its towns. */
export function listPages(catalog: Catalog): BlogPage[] {
  return [
    ...catalog.posts.map((post): BlogPage => ({ kind: 'post', post })),
    ...[...catalog.cities.values()].flatMap((city): BlogPage[] => [
      { kind: 'area', city, town: null },
      ...[...city.towns.values()].map((town): BlogPage => ({ kind: 'area', city, town })),
    ]),
  ];
}

/** The page at /blog/<segments>, or null when nothing is published there. */
export function findPage(catalog: Catalog, segments: readonly string[]): BlogPage | null {
  const path = segmentsPath(segments);
  return listPages(catalog).find((page) => pagePath(page) === path) ?? null;
}

export function postCover(post: Post): Photo {
  return post.source.kind === 'repo' ? post.source.cover : post.source.images[0];
}

/** Every photo a post shows, cover first. */
export function postPhotos(post: Post): readonly Photo[] {
  return post.source.kind === 'repo' ? [post.source.cover] : post.source.images;
}

export function pagePhotos(page: BlogPage): readonly Photo[] {
  if (page.kind === 'post') return postPhotos(page.post);
  const { image } = page.town ?? page.city;
  return image ? [image] : [];
}

export function pageUpdatedAt(page: BlogPage): IsoDate {
  return page.kind === 'post' ? page.post.updatedAt : (page.town ?? page.city).updatedAt;
}

/** The newest content date in the catalog. */
export function latestUpdate(catalog: Catalog): IsoDate | undefined {
  return listPages(catalog).map(pageUpdatedAt).sort().at(-1);
}

/** Every photo `/blog/images` may serve, by file name. The parser keeps file names unique. */
export function catalogImages(catalog: Catalog): ReadonlyMap<string, CommonsImage> {
  const areas = [...catalog.cities.values()].flatMap((city) => [city, ...city.towns.values()]);
  const images = [
    ...catalog.posts.flatMap((post) => (post.source.kind === 'panel' ? post.source.images : [])),
    ...areas.flatMap((area) => area.image ?? []),
  ];
  return new Map(images.map((image) => [image.fileName, image]));
}

/** From the blog index down to `page`, inclusive. */
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

/** The posts in a city, its towns included, or in one town. */
export function areaPosts(catalog: Catalog, { city, town }: AreaPage): Post[] {
  return catalog.posts.filter(
    ({ areas: [postCity, postTown] }) =>
      postCity?.slug === city.slug && (!town || postTown?.slug === town.slug)
  );
}

/**
 * Up to `limit` other posts: those that share the occasion first, then those in the same
 * place, then the newest.
 */
export function relatedPosts(catalog: Catalog, post: Post, limit = 4): Post[] {
  const score = (other: Post) =>
    (other.occasion.key === post.occasion.key ? 4 : 0) +
    post.areas.filter((area, index) => other.areas[index]?.slug === area.slug).length;
  return catalog.posts
    .filter((other) => other !== post)
    .map((other) => ({ other, score: score(other) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ other }) => other);
}
