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

/** A value from the panel's taxonomy, such as `{ key: 'weekday-lunch', label: 'Weekday lunch' }`. */
export interface Term {
  key: string;
  label: string;
}

/** Text fields hold Markdown in the contract's subset. */
export interface Guide {
  slug: string;
  occasion: Term;
  /** The optional parameters the guide sets, in the order time, venue type, group size, budget. */
  parameters: readonly Term[];
  updatedAt: IsoDate;
  seo: Seo;
  intro: string;
  tips: string;
  places: readonly CuratedPlace[];
}

/** A city or a town: what a hub page is about. Maps are keyed by slug, in the panel's order. */
export interface Area {
  slug: string;
  name: string;
  updatedAt: IsoDate;
  seo: Seo;
  intro: string;
  transitNotes: string;
  guides: ReadonlyMap<string, Guide>;
}

/** Its town slugs and its own guide slugs never overlap, since both follow /where-to-meet/<city>/. */
export interface City extends Area {
  region: string;
  towns: ReadonlyMap<string, Area>;
}

/** Everything published, keyed by slug in the control plane's order. */
export interface Catalog {
  cities: ReadonlyMap<string, City>;
}

/** A city's or a town's page. A null `town` means the page covers the whole city. */
export type HubPage = { kind: 'hub'; city: City; town: Area | null };
/** One guide in a city or a town. */
export type GuidePage = { kind: 'guide'; city: City; town: Area | null; guide: Guide };
/** A page below the index. */
export type GuidesPage = HubPage | GuidePage;

export interface Crumb {
  name: string;
  path: string;
}

/** Hubs and guides depth first: a city, its guides, then each town and its guides. */
export function listPages(catalog: Catalog): GuidesPage[] {
  return [...catalog.cities.values()].flatMap((city) => [
    ...areaPages(city, null),
    ...[...city.towns.values()].flatMap((town) => areaPages(city, town)),
  ]);
}

function areaPages(city: City, town: Area | null): GuidesPage[] {
  return [
    { kind: 'hub', city, town },
    ...[...(town ?? city).guides.values()].map((guide) => ({
      kind: 'guide' as const,
      city,
      town,
      guide,
    })),
  ];
}

/** `['new-york', 'midtown', 'quiet-places-for-a-team-meeting']`: the URL segments after /where-to-meet. */
export function pageSegments(page: GuidesPage): string[] {
  return [
    page.city.slug,
    ...(page.town ? [page.town.slug] : []),
    ...(page.kind === 'guide' ? [page.guide.slug] : []),
  ];
}

export function pagePath(page: GuidesPage): string {
  return [GUIDES_PATH, ...pageSegments(page)].join('/');
}

export function coverPath(page: GuidesPage): string {
  return `${pagePath(page)}/cover.png`;
}

/**
 * The page at /where-to-meet/<segments>. A second segment is a town when one has that slug,
 * otherwise one of the city's own guides. A third is a guide in that town.
 */
export function findPage(catalog: Catalog, segments: readonly string[]): GuidesPage | null {
  const [citySlug, second, third, ...rest] = segments;
  const city = citySlug === undefined ? undefined : catalog.cities.get(citySlug);
  if (!city || rest.length > 0) return null;
  if (second === undefined) return { kind: 'hub', city, town: null };

  const town = city.towns.get(second);
  if (third === undefined) {
    if (town) return { kind: 'hub', city, town };
    const guide = city.guides.get(second);
    return guide ? { kind: 'guide', city, town: null, guide } : null;
  }
  const guide = town?.guides.get(third);
  return town && guide ? { kind: 'guide', city, town, guide } : null;
}

export function pageArea(page: GuidesPage): Area {
  return page.town ?? page.city;
}

/** The fields every page has, from the guide or from its city or town. */
export function pageEntry(page: GuidesPage): Guide | Area {
  return page.kind === 'guide' ? page.guide : pageArea(page);
}

/** The hub a guide belongs to, or the hub itself. */
export function hubOf(page: GuidesPage): HubPage {
  return { kind: 'hub', city: page.city, town: page.town };
}

/** From the guides index down to `page`, inclusive. A guide is named by its title. */
export function pageTrail(page: GuidesPage): Crumb[] {
  const cityHub: HubPage = { kind: 'hub', city: page.city, town: null };
  return [
    { name: 'Where to meet', path: GUIDES_PATH },
    { name: page.city.name, path: pagePath(cityHub) },
    ...(page.town ? [{ name: page.town.name, path: pagePath(hubOf(page)) }] : []),
    ...(page.kind === 'guide' ? [{ name: page.guide.seo.title, path: pagePath(page) }] : []),
  ];
}

export interface OccasionGroup {
  occasion: Term;
  guides: Guide[];
}

/** An area's guides by occasion. Groups follow the order of their first guide. */
export function guidesByOccasion(area: Area): OccasionGroup[] {
  const groups = new Map<string, OccasionGroup>();
  for (const guide of area.guides.values()) {
    const group = groups.get(guide.occasion.key);
    if (group) group.guides.push(guide);
    else groups.set(guide.occasion.key, { occasion: guide.occasion, guides: [guide] });
  }
  return [...groups.values()];
}

/** The newest content date across the catalog, or null when nothing is published. */
export function latestUpdate(catalog: Catalog): IsoDate | null {
  const dates = listPages(catalog).map((page) => pageEntry(page).updatedAt);
  return dates.sort().at(-1) ?? null;
}
