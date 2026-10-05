import { OCCASIONS, type Occasion } from '@/content/blog/posts';
import type { IsoDate } from '@/lib/seo/site-pages';

export const GUIDES_PATH = '/where-to-meet';
/** The cache tag on the control plane fetch, and the tag its revalidation webhook sends. */
export const GUIDES_TAG = 'where2meet-guides';

export interface Seo {
  title: string;
  description: string;
}

/** A Google place an editor picked. `label` and `note` are the editor's words, never Google's. */
export interface CuratedPlace {
  placeId: string;
  label: string;
  note: string;
}

/** Text fields hold Markdown in the contract's subset. */
export interface Guide {
  occasion: Occasion;
  updatedAt: IsoDate;
  seo: Seo;
  intro: string;
  tips: string;
  places: readonly CuratedPlace[];
}

/** A city or a town: what a hub page is about. */
export interface Area {
  slug: string;
  name: string;
  updatedAt: IsoDate;
  seo: Seo;
  intro: string;
  transitNotes: string;
  guides: readonly Guide[];
}

export interface City extends Area {
  region: string;
  towns: readonly Area[];
}

/** Everything published, in the control plane's order. */
export interface Catalog {
  cities: readonly City[];
}

/** A page below the index. A null `town` means the page covers the whole city. */
export type GuidesPage =
  | { kind: 'hub'; city: City; town: Area | null }
  | { kind: 'guide'; city: City; town: Area | null; guide: Guide };

export interface Crumb {
  name: string;
  path: string;
}

/** Hubs and guides depth first: a city, its guides, then each town and its guides. */
export function listPages(catalog: Catalog): GuidesPage[] {
  return catalog.cities.flatMap((city) => [
    ...areaPages(city, null),
    ...city.towns.flatMap((town) => areaPages(city, town)),
  ]);
}

function areaPages(city: City, town: Area | null): GuidesPage[] {
  return [
    { kind: 'hub', city, town },
    ...(town ?? city).guides.map((guide) => ({ kind: 'guide' as const, city, town, guide })),
  ];
}

/** `['new-york', 'williamsburg', 'date-night']`: the URL segments after /where-to-meet. */
export function pageSegments(page: GuidesPage): string[] {
  return [
    page.city.slug,
    ...(page.town ? [page.town.slug] : []),
    ...(page.kind === 'guide' ? [page.guide.occasion] : []),
  ];
}

export function pagePath(page: GuidesPage): string {
  return [GUIDES_PATH, ...pageSegments(page)].join('/');
}

export function coverPath(page: GuidesPage): string {
  return `${pagePath(page)}/cover.png`;
}

/** Slugs never equal an occasion key, so one lookup tells a town hub from a city guide. */
export function findPage(catalog: Catalog, segments: readonly string[]): GuidesPage | null {
  const path = [GUIDES_PATH, ...segments].join('/');
  return listPages(catalog).find((page) => pagePath(page) === path) ?? null;
}

export function pageArea(page: GuidesPage): Area {
  return page.town ?? page.city;
}

/** The fields every page has, from the guide or from its city or town. */
export function pageEntry(page: GuidesPage): Guide | Area {
  return page.kind === 'guide' ? page.guide : pageArea(page);
}

/** The hub a guide belongs to, or the hub itself. */
export function hubOf(page: GuidesPage): GuidesPage {
  return { kind: 'hub', city: page.city, town: page.town };
}

/** From the guides index down to `page`, inclusive. */
export function pageTrail(page: GuidesPage): Crumb[] {
  const cityHub: GuidesPage = { kind: 'hub', city: page.city, town: null };
  return [
    { name: 'Where to meet', path: GUIDES_PATH },
    { name: page.city.name, path: pagePath(cityHub) },
    ...(page.town ? [{ name: page.town.name, path: pagePath(hubOf(page)) }] : []),
    ...(page.kind === 'guide'
      ? [{ name: OCCASIONS[page.guide.occasion].label, path: pagePath(page) }]
      : []),
  ];
}

/** The newest content date across the catalog, or null when nothing is published. */
export function latestUpdate(catalog: Catalog): IsoDate | null {
  const dates = listPages(catalog).map((page) => pageEntry(page).updatedAt);
  return dates.sort().at(-1) ?? null;
}
