import {
  areaPosts,
  pagePath,
  postPath,
  type Catalog,
  type City,
} from '@/features/blog/lib/catalog';
import { HOME_OCCASIONS } from './occasions';

export interface GuideLink {
  href: string;
  title: string;
}

export interface HomeGuides {
  cities: GuideLink[];
  posts: GuideLink[];
}

export function homeGuides(catalog: Catalog): HomeGuides {
  const guideCount = (city: City) => areaPosts(catalog, { kind: 'area', city, town: null }).length;
  const cities = [...catalog.cities.values()]
    .toSorted((a, b) => guideCount(b) - guideCount(a) || a.name.localeCompare(b.name))
    .map((city) => ({ href: pagePath({ kind: 'area', city, town: null }), title: city.seo.title }));

  const newestFirst = catalog.posts.toSorted((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const posts = HOME_OCCASIONS.flatMap(
    ({ key }) => newestFirst.find((post) => post.occasion.key === key) ?? []
  ).map((post) => ({ href: postPath(post), title: post.title }));

  return { cities, posts };
}
