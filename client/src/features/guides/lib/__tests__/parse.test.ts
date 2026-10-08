import { describe, expect, it } from 'vitest';
import { parsePublished } from '../parse';

const seo = { title: 'Where to meet in Testville', description: 'A description long enough.' };

const taxonomy = {
  occasions: [
    { key: 'team-welcome', label: 'Team welcome' },
    { key: 'date-night', label: 'Date night' },
  ],
  times: [{ key: 'weekday-lunch', label: 'Weekday lunch' }],
  venue_types: [{ key: 'chinese-restaurant', label: 'Chinese restaurant' }],
  group_sizes: [{ key: 'large', label: 'Big group, 7 or more' }],
  budgets: [{ key: 'moderate', label: 'Mid-range' }],
};

function guide(slug: unknown, fields: Record<string, unknown> = {}) {
  return {
    slug,
    occasion: 'team-welcome',
    time: null,
    venue_type: null,
    group_size: null,
    budget: null,
    updated_at: '2026-10-08',
    seo,
    intro: 'Intro',
    tips: 'Tips',
    places: [],
    ...fields,
  };
}

function area(slug: unknown, guides: unknown[] = [], extra: Record<string, unknown> = {}) {
  return {
    slug,
    name: 'Testville',
    updated_at: '2026-10-08',
    seo,
    intro: 'Hello',
    transit_notes: 'Bus',
    guides,
    ...extra,
  };
}

function published(cities: unknown[], taxonomyLists: Record<string, unknown> = taxonomy) {
  return { version: 2, generated_at: '2026-10-08T12:00:00Z', taxonomy: taxonomyLists, cities };
}

describe('parsePublished', () => {
  it('maps contract fields to the catalog with labels from the taxonomy', () => {
    const { catalog, issues } = parsePublished(
      published([
        area(
          'testville',
          [
            guide('chinese-restaurants-for-a-team-welcome-lunch', {
              budget: 'moderate',
              group_size: 'large',
              venue_type: 'chinese-restaurant',
              time: 'weekday-lunch',
              places: [{ place_id: 'ChIJ1', label: 'Golden Duck', note: 'Round tables' }],
            }),
          ],
          {
            region: 'TV',
            country: 'US',
            center: { lat: 1, lng: 2 },
            towns: [
              area('old-town', [guide('date-night-in-old-town', { occasion: 'date-night' })]),
            ],
          }
        ),
      ])
    );

    expect(issues).toEqual([]);
    expect(catalog).toEqual({
      cities: new Map([
        [
          'testville',
          {
            slug: 'testville',
            name: 'Testville',
            region: 'TV',
            updatedAt: '2026-10-08',
            seo,
            intro: 'Hello',
            transitNotes: 'Bus',
            guides: new Map([
              [
                'chinese-restaurants-for-a-team-welcome-lunch',
                {
                  slug: 'chinese-restaurants-for-a-team-welcome-lunch',
                  occasion: { key: 'team-welcome', label: 'Team welcome' },
                  parameters: [
                    { key: 'weekday-lunch', label: 'Weekday lunch' },
                    { key: 'chinese-restaurant', label: 'Chinese restaurant' },
                    { key: 'large', label: 'Big group, 7 or more' },
                    { key: 'moderate', label: 'Mid-range' },
                  ],
                  updatedAt: '2026-10-08',
                  seo,
                  intro: 'Intro',
                  tips: 'Tips',
                  places: [{ placeId: 'ChIJ1', label: 'Golden Duck', note: 'Round tables' }],
                },
              ],
            ]),
            towns: new Map([
              [
                'old-town',
                {
                  slug: 'old-town',
                  name: 'Testville',
                  updatedAt: '2026-10-08',
                  seo,
                  intro: 'Hello',
                  transitNotes: 'Bus',
                  guides: new Map([
                    [
                      'date-night-in-old-town',
                      {
                        slug: 'date-night-in-old-town',
                        occasion: { key: 'date-night', label: 'Date night' },
                        parameters: [],
                        updatedAt: '2026-10-08',
                        seo,
                        intro: 'Intro',
                        tips: 'Tips',
                        places: [],
                      },
                    ],
                  ]),
                },
              ],
            ]),
          },
        ],
      ]),
    });
  });

  it('drops each bad item, keeps its siblings and says why', () => {
    const longest = 'a'.repeat(80);
    const { catalog, issues } = parsePublished(
      published(
        [
          area(
            'testville',
            [
              guide('brunch-spots', { occasion: 'brunch' }),
              guide('no-occasion', { occasion: null }),
              guide('sushi', { venue_type: 'sushi-bar' }),
              guide('after-work-drinks', { time: 'after-work' }),
              guide('big-group', { group_size: 7 }),
              guide('Team-Lunch'),
              guide(`${longest}b`),
              guide(longest),
              guide('midtown'),
              guide('lunch', {
                places: [
                  { label: 'No id' },
                  { place_id: 'ChIJ2', label: '  ' },
                  { place_id: 'ChIJ3', label: 'Kept' },
                  { place_id: 'ChIJ3', label: 'Listed twice' },
                ],
              }),
              guide('lunch'),
              guide('stale', { updated_at: '2026-13-45' }),
            ],
            {
              towns: [
                area('Old Town'),
                area('midtown', [guide('lunch'), guide('lunch')]),
                area('midtown'),
                { ...area('pier'), seo: { title: 'No description' } },
              ],
            }
          ),
          area('testville'),
          'not a city',
        ],
        {
          ...taxonomy,
          times: [
            { key: 'after-work' },
            { key: 'weekday-lunch', label: 'Weekday lunch' },
            { key: 'weekday-lunch', label: 'Lunch on a weekday' },
          ],
        }
      )
    );

    expect(issues).toEqual([
      'taxonomy.times[0]: missing label',
      'taxonomy.times: repeats "weekday-lunch"',
      'cities[0].towns[0]: invalid slug "Old Town"',
      'cities[0].towns[1].guides: repeats "lunch"',
      'cities[0].towns[3]: invalid seo',
      'cities[0].towns: repeats "midtown"',
      'cities[0].guides[0]: unknown occasion "brunch"',
      'cities[0].guides[1]: unknown occasion null',
      'cities[0].guides[2]: unknown venue_type "sushi-bar"',
      'cities[0].guides[3]: unknown time "after-work"',
      'cities[0].guides[4]: unknown group_size 7',
      'cities[0].guides[5]: invalid slug "Team-Lunch"',
      'cities[0].guides[6]: slug is longer than 80 characters',
      'cities[0].guides[8]: slug "midtown" is taken by a town',
      'cities[0].guides[9].places[0]: missing place_id',
      'cities[0].guides[9].places[1]: missing label',
      'cities[0].guides[9].places: repeats "ChIJ3"',
      'cities[0].guides[11]: invalid updated_at',
      'cities[0].guides: repeats "lunch"',
      'cities[2]: not an object',
      'cities: repeats "testville"',
    ]);
    expect([...catalog.cities.keys()]).toEqual(['testville']);
    const city = catalog.cities.get('testville');
    expect(
      [...(city?.guides.values() ?? [])].map((g) => [g.slug, g.places.map((p) => p.placeId)])
    ).toEqual([
      [longest, []],
      ['lunch', ['ChIJ3']],
    ]);
    expect([...(city?.towns.keys() ?? [])]).toEqual(['midtown']);
    expect([...(city?.towns.get('midtown')?.guides.keys() ?? [])]).toEqual(['lunch']);
  });

  it('rejects a payload that is not contract v2', () => {
    for (const raw of [
      { version: 1, cities: [] },
      { version: 2, cities: [] },
      { version: 2, taxonomy, cities: {} },
      '<html>',
    ]) {
      expect(() => parsePublished(raw)).toThrow('Published guides are not contract v2 JSON');
    }
  });
});
