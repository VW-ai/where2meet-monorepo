import { describe, expect, it } from 'vitest';
import { fixtureContent } from '../../__fixtures__/content-files';
import {
  areaPosts,
  catalogImages,
  findPage,
  latestUpdate,
  listPages,
  pagePath,
  pageTrail,
  pageUpdatedAt,
  postPath,
  relatedPosts,
  type BlogPage,
} from '../catalog';
import { parseCatalog } from '../parse';

const catalog = parseCatalog(fixtureContent()).catalog;

function describePage(page: BlogPage | null) {
  if (!page) return null;
  if (page.kind === 'area')
    return `${page.town ? 'town' : 'city'} ${(page.town ?? page.city).name}`;
  return `post ${page.post.title}`;
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
      '/blog/new-york/midtown/a-team-welcome-lunch-in-bryant-park',
      '/blog/how-to-plan-a-team-welcome-lunch',
      '/blog/new-york/group-dinner-spots-near-herald-square',
      '/blog/new-york/midtown/quiet-places-for-a-small-team-meeting',
      '/blog/new-york',
      '/blog/new-york/midtown',
    ]);
  });

  it('resolves one segment to a general post or a city', () => {
    expect(resolve('how-to-plan-a-team-welcome-lunch')).toBe(
      'post How to plan a team welcome lunch'
    );
    expect(resolve('new-york')).toBe('city New York');
  });

  it('resolves two segments to a town or a city post, and three to a town post', () => {
    expect(resolve('new-york/midtown')).toBe('town Midtown');
    expect(resolve('new-york/group-dinner-spots-near-herald-square')).toBe(
      'post Group dinner spots near Herald Square'
    );
    expect(resolve('new-york/midtown/quiet-places-for-a-small-team-meeting')).toBe(
      'post Quiet places for a small team meeting in Midtown'
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
      'new-york/how-to-plan-a-team-welcome-lunch',
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

  it('relates posts by a shared occasion, then a shared town, then a shared city', () => {
    expect(
      relatedPosts(catalog, post('new-york/midtown/a-team-welcome-lunch-in-bryant-park')).map(
        postPath
      )
    ).toEqual([
      '/blog/how-to-plan-a-team-welcome-lunch',
      '/blog/new-york/midtown/quiet-places-for-a-small-team-meeting',
      '/blog/new-york/group-dinner-spots-near-herald-square',
    ]);
  });

  it('breaks a tie by the next slug in alphabetical order, wrapping around, not by date', () => {
    expect(relatedPosts(catalog, post('how-to-plan-a-team-welcome-lunch')).map(postPath)).toEqual([
      '/blog/new-york/midtown/a-team-welcome-lunch-in-bryant-park',
      '/blog/new-york/midtown/quiet-places-for-a-small-team-meeting',
      '/blog/new-york/group-dinner-spots-near-herald-square',
    ]);
  });

  it('ranks a shared venue type above a shared city', () => {
    const groupDinner = post('new-york/group-dinner-spots-near-herald-square');
    const quiet = post('new-york/midtown/quiet-places-for-a-small-team-meeting');
    const [newYork] = groupDinner.areas;
    const barbecue = {
      ...quiet,
      slug: 'korean-barbecue-in-testville',
      title: 'Korean barbecue in Testville',
      parameters: { ...quiet.parameters, venue_type: groupDinner.parameters.venue_type },
      areas: [{ ...newYork, slug: 'testville', name: 'Testville' }],
    } as typeof quiet;
    const withBarbecue = { ...catalog, posts: [...catalog.posts, barbecue] };
    expect(relatedPosts(withBarbecue, groupDinner).map((other) => other.title)).toEqual([
      'Korean barbecue in Testville',
      'Quiet places for a small team meeting in Midtown',
      'A team welcome lunch in Bryant Park',
      'How to plan a team welcome lunch',
    ]);
  });

  it('gives the last slot to the next slug after the post, skipping one already chosen, so every post gets a link', () => {
    const lunch = post('new-york/midtown/a-team-welcome-lunch-in-bryant-park');
    const dinner = post('new-york/group-dinner-spots-near-herald-square');
    const posts = [
      { ...lunch, slug: 'a-lunch' },
      { ...lunch, slug: 'b-lunch' },
      { ...dinner, slug: 'c-dinner' },
      { ...lunch, slug: 'd-lunch' },
      { ...lunch, slug: 'e-lunch' },
      { ...lunch, slug: 'f-lunch' },
    ];
    const lunches = { ...catalog, posts };
    const slugs = (from: (typeof posts)[number]) =>
      relatedPosts(lunches, from).map(({ slug }) => slug);
    expect(slugs(posts[0])).toEqual(['b-lunch', 'd-lunch', 'e-lunch', 'c-dinner']);
    expect(slugs(posts[1])).toEqual(['d-lunch', 'e-lunch', 'f-lunch', 'c-dinner']);
    expect(slugs(posts[5])).toEqual(['a-lunch', 'b-lunch', 'd-lunch', 'c-dinner']);
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
    expect(relatedPosts(withElsewhere, midtownLunch).map((other) => other.title)).toEqual([
      'How to plan a team welcome lunch',
      'Quiet places for a small team meeting in Midtown',
      'Group dinner spots near Herald Square',
      'A post in another city’s Midtown',
    ]);
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

  it('serves every post and place photo, and only those, from /blog/images', () => {
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

  it('dates a city or town page by its own file or the newest post it lists, by published date', () => {
    const city = catalog.cities.get('new-york')!;
    const midtown = city.towns.get('midtown')!;
    const lunch = post('new-york/midtown/a-team-welcome-lunch-in-bryant-park');
    const updated = { ...lunch, updatedAt: '2026-10-20' as const };
    const edited = {
      ...catalog,
      posts: catalog.posts.map((other) => (other === lunch ? updated : other)),
    };
    expect([city.updatedAt, midtown.updatedAt, lunch.publishedAt]).toEqual([
      '2026-10-07',
      '2026-10-07',
      '2026-10-08',
    ]);
    expect(pageUpdatedAt(edited, { kind: 'area', city, town: null })).toBe('2026-10-08');
    expect(pageUpdatedAt(edited, { kind: 'area', city, town: midtown })).toBe('2026-10-08');
    expect(
      pageUpdatedAt(edited, { kind: 'area', city, town: { ...midtown, updatedAt: '2026-10-09' } })
    ).toBe('2026-10-09');
    expect(pageUpdatedAt(edited, { kind: 'post', post: updated })).toBe('2026-10-20');
  });

  it('dates the catalog by its newest page', () => {
    expect(latestUpdate(catalog)).toBe('2026-10-08');
  });
});
