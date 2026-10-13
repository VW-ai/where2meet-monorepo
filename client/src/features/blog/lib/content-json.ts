import type { IsoDate } from '@/lib/seo/site-pages';
import {
  pagePath,
  postPath,
  type Catalog,
  type Keyword,
  type LatLng,
  type OptionalParameter,
  type Term,
} from './catalog';

type PlaceJson =
  | { path: string; kind: 'city'; slug: string; name: string; center: LatLng }
  | { path: string; kind: 'town'; slug: string; city: string; name: string; center: LatLng };

type PostJson = {
  path: string;
  title: string;
  source: 'mdx' | 'markdown';
  occasion: string;
} & Record<OptionalParameter, string | null> & {
    main_keyword: string | null;
    city: string | null;
    town: string | null;
    published_at: IsoDate;
    updated_at: IsoDate;
  };

/** `GET /blog/content.json`: the repo's blog content, as the Control Panel reads it. */
export interface ContentJson {
  version: 1;
  generated_at: string;
  taxonomy: {
    occasions: (Term & {
      times: readonly string[];
      venue_types: readonly string[];
      group_sizes: readonly string[];
    })[];
    times: Term[];
    venue_types: (Term & { google_type: string })[];
    group_sizes: Term[];
    budgets: (Term & { price_level: string })[];
  };
  keywords: Keyword[];
  /** Each city, then its towns. */
  places: PlaceJson[];
  /** Newest first, as the blog lists them. */
  posts: PostJson[];
  writing_rules: string;
}

export function buildContentJson(
  { taxonomy, keywords, posts, cities }: Catalog,
  input: { generatedAt: Date; writingRules: string }
): ContentJson {
  const term = ({ key, label }: Term): Term => ({ key, label });
  return {
    version: 1,
    generated_at: input.generatedAt.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    taxonomy: {
      occasions: taxonomy.occasions.map((occasion) => ({
        ...term(occasion),
        times: occasion.times,
        venue_types: occasion.venueTypes,
        group_sizes: occasion.groupSizes,
      })),
      times: taxonomy.times.map(term),
      venue_types: taxonomy.venueTypes.map((venueType) => ({
        ...term(venueType),
        google_type: venueType.googleType,
      })),
      group_sizes: taxonomy.groupSizes.map(term),
      budgets: taxonomy.budgets.map((budget) => ({
        ...term(budget),
        price_level: budget.priceLevel,
      })),
    },
    keywords: keywords.map(({ phrase, occasion, note }) => ({ phrase, occasion, note })),
    places: [...cities.values()].flatMap((city): PlaceJson[] => [
      {
        path: pagePath({ kind: 'area', city, town: null }),
        kind: 'city',
        slug: city.slug,
        name: city.name,
        center: city.center,
      },
      ...[...city.towns.values()].map(
        (town): PlaceJson => ({
          path: pagePath({ kind: 'area', city, town }),
          kind: 'town',
          slug: town.slug,
          city: city.slug,
          name: town.name,
          center: town.center,
        })
      ),
    ]),
    posts: posts.map((post) => ({
      path: postPath(post),
      title: post.title,
      source: post.source.kind,
      occasion: post.occasion.key,
      time: post.parameters.time?.key ?? null,
      venue_type: post.parameters.venue_type?.key ?? null,
      group_size: post.parameters.group_size?.key ?? null,
      budget: post.parameters.budget?.key ?? null,
      main_keyword: post.mainKeyword,
      city: post.areas[0]?.slug ?? null,
      town: post.areas[1]?.slug ?? null,
      published_at: post.publishedAt,
      updated_at: post.updatedAt,
    })),
    writing_rules: input.writingRules,
  };
}
