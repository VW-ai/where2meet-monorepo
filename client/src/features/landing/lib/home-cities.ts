import { citiesWithPosts, pagePath, type Catalog, type Post } from '@/features/blog/lib/catalog';
import type { Photo } from '@/features/blog/lib/photos';
import type { IsoDate } from '@/lib/seo/site-pages';

export interface HomeCity {
  href: string;
  name: string;
  photo: Photo;
  topOccasions: string[];
  linkedSince: IsoDate;
}

const CITY_LIMIT = 5;
const OCCASION_LIMIT = 2;

export function homeCities(catalog: Catalog): HomeCity[] {
  return citiesWithPosts(catalog)
    .flatMap(({ city, posts }) =>
      city.image
        ? [
            {
              href: pagePath({ kind: 'area', city, town: null }),
              name: city.name,
              photo: city.image,
              topOccasions: topOccasions(posts),
              linkedSince: posts
                .map(({ publishedAt }) => publishedAt)
                .reduce((first, date) => (date < first ? date : first)),
            },
          ]
        : []
    )
    .slice(0, CITY_LIMIT);
}

function topOccasions(posts: readonly Post[]): string[] {
  const guides = new Map<string, number>();
  for (const { occasion } of posts)
    guides.set(occasion.label, (guides.get(occasion.label) ?? 0) + 1);
  return [...guides]
    .toSorted(([, a], [, b]) => b - a)
    .slice(0, OCCASION_LIMIT)
    .map(([label]) => label);
}
