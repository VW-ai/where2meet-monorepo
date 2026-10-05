import { describe, expect, it } from 'vitest';
import { parsePublished } from '../parse';

const seo = { title: 'Where to meet in Testville', description: 'A description long enough.' };

function guide(occasion: string, places: unknown[] = []) {
  return { occasion, updated_at: '2026-10-05', seo, intro: 'Intro', tips: 'Tips', places };
}

function area(slug: unknown, guides: unknown[] = [], extra: Record<string, unknown> = {}) {
  return {
    slug,
    name: 'Testville',
    updated_at: '2026-10-05',
    seo,
    intro: 'Hello',
    transit_notes: 'Bus',
    guides,
    ...extra,
  };
}

describe('parsePublished', () => {
  it('maps contract fields to the catalog and ignores fields the site does not use', () => {
    const { catalog, issues } = parsePublished({
      version: 1,
      generated_at: '2026-10-05T12:00:00Z',
      cities: [
        area(
          'testville',
          [guide('team-meeting', [{ place_id: 'ChIJ1', label: 'Cafe', note: 'Quiet tables' }])],
          {
            region: 'TV',
            country: 'US',
            center: { lat: 1, lng: 2 },
            towns: [area('old-town', [], { intro: undefined })],
          }
        ),
      ],
    });

    expect(issues).toEqual([]);
    expect(catalog).toEqual({
      cities: [
        {
          slug: 'testville',
          name: 'Testville',
          region: 'TV',
          updatedAt: '2026-10-05',
          seo,
          intro: 'Hello',
          transitNotes: 'Bus',
          guides: [
            {
              occasion: 'team-meeting',
              updatedAt: '2026-10-05',
              seo,
              intro: 'Intro',
              tips: 'Tips',
              places: [{ placeId: 'ChIJ1', label: 'Cafe', note: 'Quiet tables' }],
            },
          ],
          towns: [
            {
              slug: 'old-town',
              name: 'Testville',
              updatedAt: '2026-10-05',
              seo,
              intro: '',
              transitNotes: 'Bus',
              guides: [],
            },
          ],
        },
      ],
    });
  });

  it('drops each bad item, keeps its siblings and says why', () => {
    const { catalog, issues } = parsePublished({
      version: 1,
      cities: [
        area(
          'testville',
          [
            guide('brunch'),
            guide('date-night', [
              { label: 'No id' },
              { place_id: 'ChIJ2', label: '  ' },
              { place_id: 'ChIJ3', label: 'Kept' },
              { place_id: 'ChIJ3', label: 'Listed twice' },
            ]),
            guide('date-night'),
            { ...guide('group-dinner'), updated_at: '2026-13-45' },
          ],
          {
            towns: [
              area('Old Town'),
              area('team-meeting'),
              area('harbor'),
              area('harbor'),
              { ...area('pier'), seo: { title: 'No description' } },
            ],
          }
        ),
        area('testville'),
        'not a city',
      ],
    });

    expect(issues).toEqual([
      'cities[0].guides[0]: unknown occasion "brunch"',
      'cities[0].guides[1].places[0]: missing place_id',
      'cities[0].guides[1].places[1]: missing label',
      'cities[0].guides[1].places: repeats "ChIJ3"',
      'cities[0].guides[3]: invalid updated_at',
      'cities[0].guides: repeats "date-night"',
      'cities[0].towns[0]: invalid slug "Old Town"',
      'cities[0].towns[1]: slug "team-meeting" is an occasion',
      'cities[0].towns[4]: invalid seo',
      'cities[0].towns: repeats "harbor"',
      'cities[2]: not an object',
      'cities: repeats "testville"',
    ]);
    expect(catalog.cities).toHaveLength(1);
    const [city] = catalog.cities;
    expect(city.guides.map((g) => [g.occasion, g.places.map((p) => p.placeId)])).toEqual([
      ['date-night', ['ChIJ3']],
    ]);
    expect(city.towns.map((town) => town.slug)).toEqual(['harbor']);
  });

  it('rejects a payload that is not contract v1', () => {
    expect(() => parsePublished({ version: 2, cities: [] })).toThrow(
      'Published guides are not contract v1 JSON'
    );
    expect(() => parsePublished('<html>')).toThrow('Published guides are not contract v1 JSON');
  });
});
