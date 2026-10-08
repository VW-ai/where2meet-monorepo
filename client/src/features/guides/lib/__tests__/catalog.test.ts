import { describe, expect, it } from 'vitest';
import fixture from '../../__fixtures__/published.json';
import {
  findPage,
  guidesByOccasion,
  latestUpdate,
  listPages,
  pageEntry,
  pagePath,
  pageTrail,
  type Catalog,
} from '../catalog';
import { parsePublished } from '../parse';

const { catalog } = parsePublished(fixture);

/** What a reader sees: the kind of page and its title. */
function resolve(from: Catalog, ...segments: string[]) {
  const page = findPage(from, segments);
  return page && [page.kind, pageEntry(page).seo.title];
}

describe('guides catalog', () => {
  it('lists each city, its guides, then each town and its guides', () => {
    expect(listPages(catalog).map(pagePath)).toEqual([
      '/where-to-meet/new-york',
      '/where-to-meet/new-york/coffee-shops-for-a-catch-up-near-union-square',
      '/where-to-meet/new-york/a-weekend-afternoon-in-bryant-park-with-friends',
      '/where-to-meet/new-york/midtown',
      '/where-to-meet/new-york/midtown/quiet-places-for-a-small-team-meeting',
      '/where-to-meet/new-york/midtown/bookable-rooms-for-a-big-team-meeting',
      '/where-to-meet/new-york/midtown/a-team-welcome-lunch-in-bryant-park',
    ]);
  });

  it('resolves a second segment to a town, else a city guide, and a third to a town guide', () => {
    expect(resolve(catalog, 'new-york')).toEqual(['hub', 'Where to meet in New York']);
    expect(resolve(catalog, 'new-york', 'midtown')).toEqual(['hub', 'Where to meet in Midtown']);
    expect(resolve(catalog, 'new-york', 'coffee-shops-for-a-catch-up-near-union-square')).toEqual([
      'guide',
      'Coffee shops for a catch-up near Union Square',
    ]);
    expect(
      resolve(catalog, 'new-york', 'midtown', 'bookable-rooms-for-a-big-team-meeting')
    ).toEqual(['guide', 'Bookable rooms for a big team meeting in Midtown']);
  });

  it('finds nothing that is not published at that path', () => {
    expect(resolve(catalog)).toBeNull();
    expect(resolve(catalog, 'boston')).toBeNull();
    expect(resolve(catalog, 'new-york', 'soho')).toBeNull();
    expect(resolve(catalog, 'new-york', 'quiet-places-for-a-small-team-meeting')).toBeNull();
    expect(
      resolve(catalog, 'new-york', 'midtown', 'coffee-shops-for-a-catch-up-near-union-square')
    ).toBeNull();
    expect(
      resolve(catalog, 'new-york', 'soho', 'quiet-places-for-a-small-team-meeting')
    ).toBeNull();
    expect(
      resolve(catalog, 'new-york', 'midtown', 'quiet-places-for-a-small-team-meeting', 'more')
    ).toBeNull();
  });

  it('keeps a slug for the town when a city guide claims it too', () => {
    const seo = (title: string) => ({ title, description: 'A description long enough.' });
    const { catalog: clashing, issues } = parsePublished({
      version: 2,
      taxonomy: { occasions: [{ key: 'date-night', label: 'Date night' }] },
      cities: [
        {
          slug: 'testville',
          name: 'Testville',
          updated_at: '2026-10-08',
          seo: seo('Testville'),
          guides: [
            {
              slug: 'harbor',
              occasion: 'date-night',
              updated_at: '2026-10-08',
              seo: seo('Date night'),
            },
          ],
          towns: [{ slug: 'harbor', name: 'Harbor', updated_at: '2026-10-08', seo: seo('Harbor') }],
        },
      ],
    });

    expect(issues).toEqual(['cities[0].guides[0]: slug "harbor" is taken by a town']);
    expect(resolve(clashing, 'testville', 'harbor')).toEqual(['hub', 'Harbor']);
  });

  it('builds breadcrumbs from the index down to a town guide, named by its title', () => {
    const page = findPage(catalog, ['new-york', 'midtown', 'a-team-welcome-lunch-in-bryant-park']);
    expect(page && pageTrail(page)).toEqual([
      { name: 'Where to meet', path: '/where-to-meet' },
      { name: 'New York', path: '/where-to-meet/new-york' },
      { name: 'Midtown', path: '/where-to-meet/new-york/midtown' },
      {
        name: 'A team welcome lunch in Bryant Park',
        path: '/where-to-meet/new-york/midtown/a-team-welcome-lunch-in-bryant-park',
      },
    ]);
  });

  it('groups an area’s guides by occasion in the order they first appear', () => {
    const midtown = catalog.cities.get('new-york')?.towns.get('midtown');
    expect(
      midtown &&
        guidesByOccasion(midtown).map(({ occasion, guides }) => [
          occasion.label,
          guides.map((guide) => [guide.slug, guide.parameters.map((term) => term.label)]),
        ])
    ).toEqual([
      [
        'Team meeting',
        [
          [
            'quiet-places-for-a-small-team-meeting',
            ['Weekday lunch', 'Small group, 3 to 6', 'Inexpensive'],
          ],
          ['bookable-rooms-for-a-big-team-meeting', ['Big group, 7 or more', 'Mid-range']],
        ],
      ],
      [
        'Team welcome',
        [
          [
            'a-team-welcome-lunch-in-bryant-park',
            ['Weekday lunch', 'Park', 'Big group, 7 or more'],
          ],
        ],
      ],
    ]);
  });

  it('dates the catalog by its newest page', () => {
    expect(latestUpdate(catalog)).toBe('2026-10-08');
    expect(latestUpdate({ cities: new Map() })).toBeNull();
  });
});
