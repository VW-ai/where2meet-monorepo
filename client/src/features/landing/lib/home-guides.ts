import {
  citiesWithPosts,
  pagePath,
  postPath,
  type Catalog,
  type Post,
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
  const cities = citiesWithPosts(catalog).map(({ city }) => ({
    href: pagePath({ kind: 'area', city, town: null }),
    title: city.seo.title,
  }));
  const posts = occasionPicks(catalog).map((post) => ({ href: postPath(post), title: post.title }));
  return { cities, posts };
}

/**
 * One post per home occasion, each from the city with the fewest picks so far, so the links spread
 * across cities. Within a city, a city-wide post beats a town post, then the newest wins.
 */
function occasionPicks(catalog: Catalog): Post[] {
  const picks: Post[] = [];
  const cityOf = (post: Post) => post.areas[0]?.slug;
  const picksIn = (post: Post) => picks.filter((pick) => cityOf(pick) === cityOf(post)).length;
  const cityWideFirst = (post: Post) => (post.areas.length === 1 ? 0 : 1);
  for (const { key } of HOME_OCCASIONS) {
    const [pick] = catalog.posts
      .filter((post) => post.occasion.key === key)
      .toSorted((a, b) => picksIn(a) - picksIn(b) || cityWideFirst(a) - cityWideFirst(b));
    if (pick) picks.push(pick);
  }
  return picks;
}
