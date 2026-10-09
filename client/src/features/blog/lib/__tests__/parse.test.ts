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

function image(fileName: unknown, fields: Record<string, unknown> = {}) {
  return {
    file_name: fileName,
    source_url: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${fileName}/1280px-${fileName}`,
    page_url: `https://commons.wikimedia.org/wiki/File:${fileName}`,
    width: 1280,
    height: 960,
    alt: 'A lawn with chairs',
    caption: 'The lawn',
    author: 'Phi',
    license: 'CC0',
    license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    cropped: false,
    ...fields,
  };
}

function post(slug: unknown, fields: Record<string, unknown> = {}) {
  return {
    slug,
    occasion: 'team-welcome',
    time: null,
    venue_type: null,
    group_size: null,
    budget: null,
    main_keyword: 'team welcome lunch',
    published_at: '2026-10-08',
    updated_at: '2026-10-08',
    seo,
    body: 'Body',
    places: [],
    images: [image(`${slug}.jpg`)],
    ...fields,
  };
}

function area(slug: unknown, posts: unknown[] = [], extra: Record<string, unknown> = {}) {
  return {
    slug,
    name: 'Testville',
    updated_at: '2026-10-08',
    seo,
    intro: 'Hello',
    transit_notes: 'Bus',
    image: null,
    posts,
    ...extra,
  };
}

function published({
  posts = [],
  cities = [],
  taxonomyLists = taxonomy,
}: {
  posts?: unknown[];
  cities?: unknown[];
  taxonomyLists?: Record<string, unknown>;
}) {
  return {
    version: 3,
    generated_at: '2026-10-08T12:00:00Z',
    taxonomy: taxonomyLists,
    posts,
    cities,
  };
}

const lawn = {
  fileName: 'lawn.jpg',
  sourceUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/lawn.jpg/1280px-lawn.jpg',
  src: '/blog/images/lawn.jpg',
  width: 1280,
  height: 960,
  alt: 'A lawn with chairs',
  caption: 'The lawn',
  credit: {
    author: 'Phi',
    license: 'CC0',
    pageUrl: 'https://commons.wikimedia.org/wiki/File:lawn.jpg',
    cropped: false,
  },
};

describe('parsePublished', () => {
  it('maps general and local posts, cities, towns and images to the catalog', () => {
    const { catalog, issues } = parsePublished(
      published({
        posts: [post('plan-a-team-welcome', { images: [image('lawn.jpg')] })],
        cities: [
          area('testville', [], {
            region: 'TV',
            country: 'US',
            towns: [
              area(
                'old-town',
                [
                  post('chinese-restaurants-for-a-team-welcome-lunch', {
                    budget: 'moderate',
                    group_size: 'large',
                    venue_type: 'chinese-restaurant',
                    time: 'weekday-lunch',
                    places: [{ place_id: 'ChIJ1', label: 'Golden Duck', note: 'Round tables' }],
                    images: [
                      image('golden-duck.jpg', {
                        license: 'CC BY 4.0',
                        author: 'Ann',
                        cropped: true,
                        caption: undefined,
                      }),
                    ],
                  }),
                ],
                {
                  name: 'Old Town',
                  image: image('old-town-square.jpg', {
                    license: 'Public domain',
                    license_url: null,
                  }),
                }
              ),
            ],
          }),
        ],
      }),
      []
    );

    expect(issues).toEqual([]);
    expect(catalog).toEqual({
      posts: [
        {
          slug: 'chinese-restaurants-for-a-team-welcome-lunch',
          areas: [
            { slug: 'testville', name: 'Testville' },
            { slug: 'old-town', name: 'Old Town' },
          ],
          title: 'Where to meet in Testville',
          description: 'A description long enough.',
          publishedAt: '2026-10-08',
          updatedAt: '2026-10-08',
          occasion: { key: 'team-welcome', label: 'Team welcome' },
          parameters: [
            { key: 'weekday-lunch', label: 'Weekday lunch' },
            { key: 'chinese-restaurant', label: 'Chinese restaurant' },
            { key: 'large', label: 'Big group, 7 or more' },
            { key: 'moderate', label: 'Mid-range' },
          ],
          places: [{ placeId: 'ChIJ1', label: 'Golden Duck', note: 'Round tables' }],
          placesTitle: 'Our picks in Old Town',
          source: {
            kind: 'panel',
            markdown: 'Body',
            images: [
              {
                fileName: 'golden-duck.jpg',
                sourceUrl:
                  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/golden-duck.jpg/1280px-golden-duck.jpg',
                src: '/blog/images/golden-duck.jpg',
                width: 1280,
                height: 960,
                alt: 'A lawn with chairs',
                caption: '',
                credit: {
                  author: 'Ann',
                  license: 'CC BY 4.0',
                  pageUrl: 'https://commons.wikimedia.org/wiki/File:golden-duck.jpg',
                  cropped: true,
                },
              },
            ],
          },
        },
        {
          slug: 'plan-a-team-welcome',
          areas: [],
          title: 'Where to meet in Testville',
          description: 'A description long enough.',
          publishedAt: '2026-10-08',
          updatedAt: '2026-10-08',
          occasion: { key: 'team-welcome', label: 'Team welcome' },
          parameters: [],
          places: [],
          placesTitle: 'Our picks',
          source: { kind: 'panel', markdown: 'Body', images: [lawn] },
        },
      ],
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
            image: null,
            towns: new Map([
              [
                'old-town',
                {
                  slug: 'old-town',
                  name: 'Old Town',
                  updatedAt: '2026-10-08',
                  seo,
                  intro: 'Hello',
                  transitNotes: 'Bus',
                  image: {
                    ...lawn,
                    fileName: 'old-town-square.jpg',
                    sourceUrl:
                      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/old-town-square.jpg/1280px-old-town-square.jpg',
                    src: '/blog/images/old-town-square.jpg',
                    credit: {
                      author: 'Phi',
                      license: 'Public domain',
                      pageUrl: 'https://commons.wikimedia.org/wiki/File:old-town-square.jpg',
                      cropped: false,
                    },
                  },
                },
              ],
            ]),
          },
        ],
      ]),
    });
  });

  it('drops each bad image and keeps the post while it has one left for its cover', () => {
    const { catalog, issues } = parsePublished(
      published({
        posts: [
          post('photos', {
            images: [
              image('share-alike.jpg', { license: 'CC BY-SA 4.0' }),
              image('IMG_1234.JPG'),
              image('lawn.jpg'),
              image('lawn.jpg', { caption: 'Listed twice' }),
              image('hotlinked.jpg', { source_url: 'https://example.com/lawn.jpg' }),
              image('plain-http.jpg', {
                source_url: 'http://upload.wikimedia.org/wikipedia/commons/a/ab/x.jpg',
              }),
              image('not-commons.jpg', { page_url: 'https://example.com/wiki/File:x.jpg' }),
              image('no-size.jpg', { width: 0 }),
              image('no-alt.jpg', { alt: ' ' }),
              image('no-author.jpg', { author: null }),
              image('unlicensed.jpg', { license: 'All rights reserved' }),
              image('a-png.jpg', {
                source_url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/x.png',
              }),
              'not an image',
            ],
          }),
          post('only-bad-photos', {
            images: [image('share-alike-2.jpg', { license: 'CC BY-SA 3.0' })],
          }),
          post('no-photos', { images: [] }),
          post('reuses-a-photo', { images: [image('lawn.jpg')] }),
        ],
      }),
      []
    );

    expect(issues).toEqual([
      'posts[0].images[0]: license "CC BY-SA 4.0" is not allowed',
      'posts[0].images[1]: invalid file_name "IMG_1234.JPG"',
      'posts[0].images[3]: file_name "lawn.jpg" is already used',
      'posts[0].images[4]: source_url is not a Wikimedia JPEG upload',
      'posts[0].images[5]: source_url is not a Wikimedia JPEG upload',
      'posts[0].images[6]: page_url is not a Wikimedia Commons file page',
      'posts[0].images[7]: invalid width or height',
      'posts[0].images[8]: missing alt',
      'posts[0].images[9]: missing author',
      'posts[0].images[10]: license "All rights reserved" is not allowed',
      'posts[0].images[11]: source_url is not a Wikimedia JPEG upload',
      'posts[0].images[12]: not an object',
      'posts[1].images[0]: license "CC BY-SA 3.0" is not allowed',
      'posts[1]: no image to use as its cover',
      'posts[2]: no image to use as its cover',
      'posts[3].images[0]: file_name "lawn.jpg" is already used',
      'posts[3]: no image to use as its cover',
    ]);
    expect(
      catalog.posts.map((kept) => [
        kept.slug,
        kept.source.kind === 'panel' && kept.source.images.map((kept) => kept.fileName),
      ])
    ).toEqual([['photos', ['lawn.jpg']]]);
  });

  it('gives /blog/<segment> to repo posts first, then the photo route, cities and general posts', () => {
    const { catalog, issues } = parsePublished(
      published({
        posts: [
          post('how-to-pick-a-date-spot'),
          post('images'),
          post('testville'),
          post('team-welcome'),
          post('team-welcome', { images: [image('team-welcome-2.jpg')] }),
        ],
        cities: [area('how-to-pick-a-date-spot'), area('testville'), area('testville')],
      }),
      ['how-to-pick-a-date-spot']
    );

    expect(issues).toEqual([
      'cities[0]: slug "how-to-pick-a-date-spot" is taken by a repo post',
      'cities[2]: slug "testville" is taken by a city',
      'posts[0]: slug "how-to-pick-a-date-spot" is taken by a repo post',
      'posts[1]: slug "images" is taken by the photo route',
      'posts[2]: slug "testville" is taken by a city',
      'posts[4]: slug "team-welcome" is taken by a post',
    ]);
    expect([...catalog.cities.keys()]).toEqual(['testville']);
    expect(catalog.posts.map(({ slug }) => slug)).toEqual(['team-welcome']);
  });

  it('gives a town its slug over a city post, and keeps post slugs unique in each area', () => {
    const { catalog, issues } = parsePublished(
      published({
        cities: [
          area(
            'testville',
            [post('harbor'), post('lunch'), post('lunch', { images: [image('lunch-2.jpg')] })],
            {
              towns: [
                area('harbor', [
                  post('lunch', { images: [image('harbor-lunch.jpg')] }),
                  post('lunch', { images: [image('harbor-lunch-2.jpg')] }),
                ]),
                area('harbor'),
                area('Old Town'),
              ],
            }
          ),
        ],
      }),
      []
    );

    expect(issues).toEqual([
      'cities[0].towns[0].posts[1]: slug "lunch" is taken by a post',
      'cities[0].towns[1]: slug "harbor" is taken by a town',
      'cities[0].towns[2]: invalid slug "Old Town"',
      'cities[0].posts[0]: slug "harbor" is taken by a town',
      'cities[0].posts[2]: slug "lunch" is taken by a post',
    ]);
    expect(catalog.posts.map(({ areas, slug }) => [...areas.map((a) => a.slug), slug])).toEqual([
      ['testville', 'harbor', 'lunch'],
      ['testville', 'lunch'],
    ]);
  });

  it('drops each bad post, place, area and taxonomy value, and says why', () => {
    const longest = 'a'.repeat(80);
    const { catalog, issues } = parsePublished(
      published({
        posts: [
          post('brunch-spots', { occasion: 'brunch' }),
          post('sushi', { venue_type: 'sushi-bar' }),
          post('big-group', { group_size: 7 }),
          post('Team-Lunch'),
          post(`${longest}b`),
          post(longest),
          post('stale', { updated_at: '2026-13-45' }),
          post('undated', { published_at: null }),
          post('no-seo', { seo: { title: 'No description' } }),
          post('lunch', {
            places: [
              { label: 'No id' },
              { place_id: 'ChIJ2', label: '  ' },
              { place_id: 'ChIJ3', label: 'Kept' },
              { place_id: 'ChIJ3', label: 'Listed twice' },
            ],
          }),
        ],
        cities: [
          area('pier', [], { seo: { title: 'No description' } }),
          area('bay', [], { image: image('bay.jpg', { license: 'CC BY-SA 2.0' }) }),
          'not a city',
        ],
        taxonomyLists: {
          ...taxonomy,
          times: [
            { key: 'after-work' },
            { key: 'weekday-lunch', label: 'Weekday lunch' },
            { key: 'weekday-lunch', label: 'Lunch on a weekday' },
          ],
        },
      }),
      []
    );

    expect(issues).toEqual([
      'taxonomy.times[0]: missing label',
      'taxonomy.times[2]: repeats "weekday-lunch"',
      'cities[0]: invalid seo',
      'cities[1].image: license "CC BY-SA 2.0" is not allowed',
      'cities[2]: not an object',
      'posts[0]: unknown occasion "brunch"',
      'posts[1]: unknown venue_type "sushi-bar"',
      'posts[2]: unknown group_size 7',
      'posts[3]: invalid slug "Team-Lunch"',
      'posts[4]: slug is longer than 80 characters',
      'posts[6]: invalid updated_at',
      'posts[7]: invalid published_at',
      'posts[8]: invalid seo',
      'posts[9].places[0]: missing place_id',
      'posts[9].places[1]: missing label',
      'posts[9].places[3]: repeats "ChIJ3"',
    ]);
    expect([...catalog.cities.values()].map(({ slug, image }) => [slug, image])).toEqual([
      ['bay', null],
    ]);
    expect(catalog.posts.map(({ slug, places }) => [slug, places.map((p) => p.placeId)])).toEqual([
      [longest, []],
      ['lunch', ['ChIJ3']],
    ]);
  });

  it('rejects a payload that is not contract v3', () => {
    for (const raw of [
      { version: 2, taxonomy, cities: [] },
      { version: 3, taxonomy, cities: [] },
      { version: 3, taxonomy, posts: [], cities: {} },
      { version: 3, posts: [], cities: [] },
      '<html>',
    ]) {
      expect(() => parsePublished(raw, [])).toThrow('Published posts are not contract v3 JSON');
    }
  });
});
