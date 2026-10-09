import { describe, expect, it } from 'vitest';
import { REPO_POSTS } from '@/content/blog/posts';
import fixture from '../../__fixtures__/published.json';
import {
  areaPosts,
  catalogImages,
  findPage,
  latestUpdate,
  listPages,
  pagePath,
  pageTrail,
  postPath,
  relatedPosts,
  withRepoPosts,
  type BlogPage,
} from '../catalog';
import { parsePublished } from '../parse';

const catalog = withRepoPosts(
  REPO_POSTS,
  parsePublished(
    fixture,
    REPO_POSTS.map(({ slug }) => slug)
  ).catalog
);

function describePage(page: BlogPage | null) {
  if (!page) return null;
  if (page.kind === 'area')
    return `${page.town ? 'town' : 'city'} ${(page.town ?? page.city).name}`;
  return `${page.post.source.kind} post ${page.post.title}`;
}

function resolve(path: string) {
  return describePage(findPage(catalog, path.split('/').filter(Boolean)));
}

function post(path: string) {
  const page = findPage(catalog, path.split('/'));
  if (page?.kind !== 'post') throw new Error(`No post at ${path}`);
  return page.post;
}

describe('blog catalog', () => {
  it('lists every post newest first, then each city and its towns', () => {
    expect(listPages(catalog).map(pagePath)).toEqual([
      '/blog/how-to-pick-a-restaurant-for-a-group-dinner',
      '/blog/how-to-pick-a-date-spot',
      '/blog/new-york/midtown/a-team-welcome-lunch-in-bryant-park',
      '/blog/how-to-plan-a-team-welcome-lunch',
      '/blog/new-york/group-dinner-spots-near-herald-square',
      '/blog/how-to-plan-a-weekend-hangout-with-friends',
      '/blog/new-york/midtown/quiet-places-for-a-small-team-meeting',
      '/blog/how-to-choose-a-team-meeting-location',
      '/blog/new-york',
      '/blog/new-york/midtown',
    ]);
  });

  it('resolves one segment to a repo post, a general post or a city', () => {
    expect(resolve('how-to-pick-a-date-spot')).toBe(
      'repo post How to pick a date spot you can both reach'
    );
    expect(resolve('how-to-plan-a-team-welcome-lunch')).toBe(
      'panel post How to plan a team welcome lunch'
    );
    expect(resolve('new-york')).toBe('city New York');
  });

  it('resolves two segments to a town or a city post, and three to a town post', () => {
    expect(resolve('new-york/midtown')).toBe('town Midtown');
    expect(resolve('new-york/group-dinner-spots-near-herald-square')).toBe(
      'panel post Group dinner spots near Herald Square'
    );
    expect(resolve('new-york/midtown/quiet-places-for-a-small-team-meeting')).toBe(
      'panel post Quiet places for a small team meeting in Midtown'
    );
  });

  it('finds nothing where nothing is published', () => {
    for (const path of [
      '',
      'boston',
      'midtown',
      'images',
      'new-york/soho',
      'new-york/quiet-places-for-a-small-team-meeting',
      'new-york/how-to-pick-a-date-spot',
      'new-york/midtown/group-dinner-spots-near-herald-square',
      'new-york/soho/quiet-places-for-a-small-team-meeting',
      'new-york/midtown/quiet-places-for-a-small-team-meeting/more',
    ]) {
      expect([path, resolve(path)]).toEqual([path, null]);
    }
  });

  it('builds breadcrumbs from the blog down to a town post, named by its title', () => {
    expect(
      pageTrail({
        kind: 'post',
        post: post('new-york/midtown/a-team-welcome-lunch-in-bryant-park'),
      })
    ).toEqual([
      { name: 'Blog', path: '/blog' },
      { name: 'New York', path: '/blog/new-york' },
      { name: 'Midtown', path: '/blog/new-york/midtown' },
      {
        name: 'A team welcome lunch in Bryant Park',
        path: '/blog/new-york/midtown/a-team-welcome-lunch-in-bryant-park',
      },
    ]);
  });

  it('relates posts on the same occasion first, then posts in the same place, then the newest', () => {
    expect(
      relatedPosts(catalog, post('new-york/midtown/a-team-welcome-lunch-in-bryant-park')).map(
        postPath
      )
    ).toEqual([
      '/blog/how-to-plan-a-team-welcome-lunch',
      '/blog/new-york/midtown/quiet-places-for-a-small-team-meeting',
      '/blog/new-york/group-dinner-spots-near-herald-square',
      '/blog/how-to-pick-a-restaurant-for-a-group-dinner',
    ]);
    expect(
      relatedPosts(catalog, post('how-to-choose-a-team-meeting-location')).map(postPath)
    ).toEqual([
      '/blog/new-york/midtown/quiet-places-for-a-small-team-meeting',
      '/blog/how-to-pick-a-restaurant-for-a-group-dinner',
      '/blog/how-to-pick-a-date-spot',
      '/blog/new-york/midtown/a-team-welcome-lunch-in-bryant-park',
    ]);
  });

  it('counts a place as shared only from the city down', () => {
    const midtownLunch = post('new-york/midtown/a-team-welcome-lunch-in-bryant-park');
    const [city, town] = midtownLunch.areas;
    const elsewhere = {
      ...post('new-york/midtown/quiet-places-for-a-small-team-meeting'),
      title: 'A post in another city’s Midtown',
      areas: [{ ...city, slug: 'testville', name: 'Testville' }, town],
    } as typeof midtownLunch;
    const withElsewhere = { ...catalog, posts: [...catalog.posts, elsewhere] };
    expect(relatedPosts(withElsewhere, midtownLunch, 6).map((other) => other.title)).toEqual(
      relatedPosts(catalog, midtownLunch, 6)
        .map((other) => other.title)
        .concat('A post in another city’s Midtown')
        .slice(0, 6)
    );
  });

  it('lists a city’s posts with its towns’ posts, and a town’s own posts', () => {
    const city = catalog.cities.get('new-york')!;
    const midtown = city.towns.get('midtown')!;
    expect(areaPosts(catalog, { kind: 'area', city, town: null }).map(postPath)).toEqual([
      '/blog/new-york/midtown/a-team-welcome-lunch-in-bryant-park',
      '/blog/new-york/group-dinner-spots-near-herald-square',
      '/blog/new-york/midtown/quiet-places-for-a-small-team-meeting',
    ]);
    expect(areaPosts(catalog, { kind: 'area', city, town: midtown }).map(postPath)).toEqual([
      '/blog/new-york/midtown/a-team-welcome-lunch-in-bryant-park',
      '/blog/new-york/midtown/quiet-places-for-a-small-team-meeting',
    ]);
  });

  it('serves every panel photo, and only those, from /blog/images', () => {
    expect([...catalogImages(catalog).keys()].sort()).toEqual([
      'bryant-park-carousel-midtown.jpg',
      'bryant-park-from-one-vanderbilt.jpg',
      'bryant-park-lawn-midtown.jpg',
      'grand-central-concourse-windows.jpg',
      'grand-central-main-concourse-new-york.jpg',
      'herald-square-plaza-new-york.jpg',
      'hot-dog-stand-times-square.jpg',
      'midtown-manhattan-skyline-new-york.jpg',
      'midtown-view-from-empire-state-building.jpg',
      'new-york-public-library-lion-midtown.jpg',
      'rockefeller-center-concourse.jpg',
      'rockefeller-center-lights-at-sunset.jpg',
      'seventh-avenue-times-square-north.jpg',
      'times-square-crowds-new-york.jpg',
    ]);
  });

  it('dates the catalog by its newest page', () => {
    expect(latestUpdate(catalog)).toBe('2026-10-08');
  });
});
