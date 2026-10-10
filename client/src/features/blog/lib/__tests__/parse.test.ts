import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { MDX_POSTS } from '@/content/blog/posts';
import type { ContentFile } from '../content-file';
import { parseCatalog, type RepoContent } from '../parse';
import { markdownFile } from '../../__fixtures__/content-files';

const seo = { title: 'Where to meet in Testville', description: 'A description long enough.' };

const repoTaxonomy = {
  occasions: [
    { key: 'team-welcome', label: 'Team welcome', times: [], venue_types: [], group_sizes: [] },
    {
      key: 'coffee-catch-up',
      label: 'Coffee catch-up',
      times: ['weekday-lunch'],
      venue_types: [],
      group_sizes: ['large'],
    },
  ],
  times: [{ key: 'weekday-lunch', label: 'Weekday lunch' }],
  venue_types: [
    { key: 'chinese-restaurant', label: 'Chinese restaurant', google_type: 'chinese_restaurant' },
  ],
  group_sizes: [{ key: 'large', label: 'Big group, 7 or more' }],
  budgets: [{ key: 'moderate', label: 'Mid-range', price_level: 'PRICE_LEVEL_MODERATE' }],
};
const TAXONOMY_YAML = stringify(repoTaxonomy);
const KEYWORDS_YAML = '- phrase: team welcome lunch\n';

function content({
  places = [],
  posts = [],
  mdx = [],
  taxonomyText = TAXONOMY_YAML,
  keywordsText = KEYWORDS_YAML,
}: Partial<RepoContent>): RepoContent {
  return { mdx, taxonomyText, keywordsText, places, posts };
}

function skipped(repo: RepoContent): string[] {
  return parseCatalog(repo).issues.map(({ file, message }) => `${file}: ${message}`);
}

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
    cropped: false,
    ...fields,
  };
}

/** `<city>.md` gets a region and a country, `<city>/<town>.md` doesn't. */
function placeFile(
  name: string,
  fields: Record<string, unknown> = {},
  body = 'Hello\n\n## Getting around\n\nBus\n'
): ContentFile {
  const city = !name.includes('/');
  return markdownFile(
    name,
    {
      name: 'Testville',
      ...(city ? { region: 'TV', country: 'US' } : {}),
      center: { lat: 42.36, lng: -71.06 },
      updated_at: '2026-10-08',
      seo,
      image: null,
      ...fields,
    },
    body
  );
}

function postFile(slug: string, fields: Record<string, unknown> = {}, body = 'Body') {
  return markdownFile(
    `${slug}.md`,
    {
      title: `Title of ${slug}`,
      description: `Description of ${slug}`,
      main_keyword: 'team welcome lunch',
      occasion: 'team-welcome',
      time: null,
      venue_type: null,
      group_size: null,
      budget: null,
      city: null,
      town: null,
      published_at: '2026-10-09',
      updated_at: '2026-10-10',
      places: [],
      images: [image(`${slug}.jpg`)],
      ...fields,
    },
    `${body}\n`
  );
}

function paths(posts: readonly { slug: string; areas: readonly { slug: string }[] }[]) {
  return posts.map(({ areas, slug }) => [...areas.map((a) => a.slug), slug].join('/'));
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

describe('parseCatalog', () => {
  it('maps place files to cities and towns, and post files to posts in them', () => {
    const { catalog, issues } = parseCatalog(
      content({
        places: [
          placeFile('testville.md'),
          placeFile(
            'testville/old-town.md',
            {
              name: 'Old Town',
              center: { lat: 42.35, lng: -71.05 },
              image: image('old-town-square.jpg', { license: 'Public domain' }),
            },
            'Cobbled lanes.\n\n## Getting around\n\nWalk from the ferry.\n'
          ),
        ],
        posts: [
          postFile('plan-a-team-welcome', { images: [image('lawn.jpg')] }),
          postFile('chinese-restaurants-for-a-team-welcome-lunch', {
            city: 'testville',
            town: 'old-town',
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
      })
    );

    expect(issues).toEqual([]);
    expect(catalog.cities).toEqual(
      new Map([
        [
          'testville',
          {
            slug: 'testville',
            name: 'Testville',
            region: 'TV',
            country: 'US',
            center: { lat: 42.36, lng: -71.06 },
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
                  center: { lat: 42.35, lng: -71.05 },
                  updatedAt: '2026-10-08',
                  seo,
                  intro: 'Cobbled lanes.',
                  transitNotes: 'Walk from the ferry.',
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
      ])
    );
    expect(catalog.posts).toEqual([
      {
        slug: 'plan-a-team-welcome',
        areas: [],
        title: 'Title of plan-a-team-welcome',
        description: 'Description of plan-a-team-welcome',
        publishedAt: '2026-10-09',
        updatedAt: '2026-10-10',
        occasion: { key: 'team-welcome', label: 'Team welcome' },
        parameters: { time: null, venue_type: null, group_size: null, budget: null },
        mainKeyword: 'team welcome lunch',
        places: [],
        placesTitle: 'Our picks',
        source: { kind: 'markdown', markdown: 'Body\n', images: [lawn] },
      },
      {
        slug: 'chinese-restaurants-for-a-team-welcome-lunch',
        areas: [
          { slug: 'testville', name: 'Testville' },
          { slug: 'old-town', name: 'Old Town' },
        ],
        title: 'Title of chinese-restaurants-for-a-team-welcome-lunch',
        description: 'Description of chinese-restaurants-for-a-team-welcome-lunch',
        publishedAt: '2026-10-09',
        updatedAt: '2026-10-10',
        occasion: { key: 'team-welcome', label: 'Team welcome' },
        parameters: {
          time: { key: 'weekday-lunch', label: 'Weekday lunch' },
          venue_type: { key: 'chinese-restaurant', label: 'Chinese restaurant' },
          group_size: { key: 'large', label: 'Big group, 7 or more' },
          budget: { key: 'moderate', label: 'Mid-range' },
        },
        mainKeyword: 'team welcome lunch',
        places: [{ placeId: 'ChIJ1', label: 'Golden Duck', note: 'Round tables' }],
        placesTitle: 'Our picks in Old Town',
        source: {
          kind: 'markdown',
          markdown: 'Body\n',
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
    ]);
  });

  it('splits a place body at its first "## Getting around" line, or keeps it all as the intro', () => {
    const { catalog } = parseCatalog(
      content({
        places: [
          placeFile(
            'testville.md',
            {},
            '\nIntro.\n\n## Getting around town\n\nStill intro.\n\n  ## Getting around  \n\nTake the bus.\n\n## Getting around\n\nStill transit.\n'
          ),
          placeFile('testville/harbor.md', {}, 'Just an intro.\n'),
        ],
      })
    );
    const city = catalog.cities.get('testville')!;
    expect([city.intro, city.transitNotes]).toEqual([
      'Intro.\n\n## Getting around town\n\nStill intro.',
      'Take the bus.\n\n## Getting around\n\nStill transit.',
    ]);
    const harbor = city.towns.get('harbor')!;
    expect([harbor.intro, harbor.transitNotes]).toEqual(['Just an intro.', '']);
  });

  it('drops each bad place file and says why, and a town whose city has no place file', () => {
    const repo = content({
      places: [
        placeFile('pier.md', { seo: { title: 'No description' } }),
        placeFile('bay.md', { image: image('bay.jpg', { license: 'CC BY-SA 2.0' }) }),
        placeFile('Upper.md'),
        placeFile('nameless.md', { name: ' ' }),
        placeFile('no-region.md', { region: undefined }),
        placeFile('no-country.md', { country: '' }),
        placeFile('off-the-map.md', { center: { lat: 91, lng: 0 } }),
        placeFile('half-a-center.md', { center: { lat: 40 } }),
        placeFile('undated.md', { updated_at: '2026-13-45' }),
        { name: 'no-front-matter.md', text: 'Just a body.\n' },
        placeFile('boston/back-bay.md'),
        placeFile('pier/dock.md'),
        placeFile('bay/a/b.md'),
      ],
    });

    expect(skipped(repo)).toEqual([
      'src/content/places/pier.md: invalid seo',
      'src/content/places/bay.md: image: license "CC BY-SA 2.0" is not allowed',
      'src/content/places/Upper.md: invalid slug "Upper"',
      'src/content/places/nameless.md: missing name',
      'src/content/places/no-region.md: missing region',
      'src/content/places/no-country.md: missing country',
      'src/content/places/off-the-map.md: invalid center',
      'src/content/places/half-a-center.md: invalid center',
      'src/content/places/undated.md: invalid updated_at',
      'src/content/places/no-front-matter.md: no front matter between two --- lines at the top',
      'src/content/places/boston/back-bay.md: city "boston" has no place file, src/content/places/boston.md',
      'src/content/places/pier/dock.md: city "pier" has a place file the site skips, src/content/places/pier.md',
      'src/content/places/bay/a/b.md: a place file is <city>.md or <city>/<town>.md',
    ]);
    expect(
      [...parseCatalog(repo).catalog.cities.values()].map(({ slug, image, towns }) => [
        slug,
        image,
        [...towns.keys()],
      ])
    ).toEqual([['bay', null, []]]);
  });

  it('gives /blog/<segment> to the photo route, then MDX posts, cities and general posts', () => {
    const repo = content({
      mdx: MDX_POSTS.filter(({ slug }) => slug === 'how-to-pick-a-date-spot'),
      places: [
        placeFile('how-to-pick-a-date-spot.md'),
        placeFile('images.md'),
        placeFile('testville.md'),
        placeFile('testville/harbor.md', { name: 'Harbor' }),
      ],
      posts: [
        postFile('harbor', { city: 'testville' }),
        postFile('how-to-pick-a-date-spot'),
        postFile('images'),
        postFile('lunch', { city: 'testville', town: 'harbor' }),
        postFile('testville'),
      ],
    });

    expect(skipped(repo)).toEqual([
      'src/content/places/how-to-pick-a-date-spot.md: slug "how-to-pick-a-date-spot" is taken by an MDX post',
      'src/content/places/images.md: slug "images" is taken by the photo route',
      'src/content/posts/harbor.md: slug "harbor" is taken by a town',
      'src/content/posts/how-to-pick-a-date-spot.md: slug "how-to-pick-a-date-spot" is taken by an MDX post',
      'src/content/posts/images.md: slug "images" is taken by the photo route',
      'src/content/posts/testville.md: slug "testville" is taken by a city',
    ]);
    const { catalog } = parseCatalog(repo);
    expect([...catalog.cities.keys()]).toEqual(['testville']);
    expect(paths(catalog.posts)).toEqual(['testville/harbor/lunch', 'how-to-pick-a-date-spot']);
  });

  it('gives each photo file name to places first, cities before towns, then posts in file order', () => {
    const repo = content({
      places: [
        placeFile('testville/harbor.md', { image: image('shared.jpg') }),
        placeFile('testville/old-town.md', { image: image('town-photo.jpg') }),
        placeFile('testville.md', { image: image('shared.jpg') }),
      ],
      posts: [
        postFile('first', { images: [image('shared.jpg'), image('first.jpg')] }),
        postFile('second', { images: [image('town-photo.jpg'), image('first.jpg')] }),
      ],
    });

    expect(skipped(repo)).toEqual([
      'src/content/places/testville/harbor.md: image: file_name "shared.jpg" is already used',
      'src/content/posts/first.md: images[0]: file_name "shared.jpg" is already used',
      'src/content/posts/second.md: images[0]: file_name "town-photo.jpg" is already used',
      'src/content/posts/second.md: images[1]: file_name "first.jpg" is already used',
      'src/content/posts/second.md: no image to use as its cover',
    ]);
    const { catalog } = parseCatalog(repo);
    const testville = catalog.cities.get('testville')!;
    expect(
      [testville, ...testville.towns.values()].map(({ slug, image }) => [slug, image?.fileName])
    ).toEqual([
      ['testville', 'shared.jpg'],
      ['harbor', undefined],
      ['old-town', 'town-photo.jpg'],
    ]);
    expect(
      catalog.posts.map((post) => [
        post.slug,
        post.source.kind === 'markdown' && post.source.images.map((kept) => kept.fileName),
      ])
    ).toEqual([['first', ['first.jpg']]]);
  });

  it('drops each bad image and keeps the post while it has one left for its cover', () => {
    const repo = content({
      posts: [
        postFile('photos', {
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
        postFile('only-bad-photos', {
          images: [image('share-alike-2.jpg', { license: 'CC BY-SA 3.0' })],
        }),
        postFile('no-photos', { images: [] }),
      ],
    });

    expect(skipped(repo)).toEqual([
      'src/content/posts/photos.md: images[0]: license "CC BY-SA 4.0" is not allowed',
      'src/content/posts/photos.md: images[1]: invalid file_name "IMG_1234.JPG"',
      'src/content/posts/photos.md: images[3]: file_name "lawn.jpg" is already used',
      'src/content/posts/photos.md: images[4]: source_url is not a Wikimedia JPEG upload',
      'src/content/posts/photos.md: images[5]: source_url is not a Wikimedia JPEG upload',
      'src/content/posts/photos.md: images[6]: page_url is not a Wikimedia Commons file page',
      'src/content/posts/photos.md: images[7]: invalid width or height',
      'src/content/posts/photos.md: images[8]: missing alt',
      'src/content/posts/photos.md: images[9]: missing author',
      'src/content/posts/photos.md: images[10]: license "All rights reserved" is not allowed',
      'src/content/posts/photos.md: images[11]: source_url is not a Wikimedia JPEG upload',
      'src/content/posts/photos.md: images[12]: not an object',
      'src/content/posts/only-bad-photos.md: images[0]: license "CC BY-SA 3.0" is not allowed',
      'src/content/posts/only-bad-photos.md: no image to use as its cover',
      'src/content/posts/no-photos.md: no image to use as its cover',
    ]);
    expect(
      parseCatalog(repo).catalog.posts.map((kept) => [
        kept.slug,
        kept.source.kind === 'markdown' && kept.source.images.map((photo) => photo.fileName),
      ])
    ).toEqual([['photos', ['lawn.jpg']]]);
  });
});

describe('parseCatalog with post files', () => {
  const places = [
    placeFile('testville.md'),
    placeFile('testville/harbor.md', { name: 'Harbor' }),
    placeFile('pier.md', { seo: null }),
  ];

  it('parses a local post with its place names and its labels from the taxonomy', () => {
    const { catalog, issues } = parseCatalog(
      content({
        places,
        posts: [
          postFile(
            'welcome-lunch',
            {
              occasion: 'coffee-catch-up',
              city: 'testville',
              town: 'harbor',
              time: 'weekday-lunch',
              group_size: 'large',
              places: [{ place_id: 'ChIJ1', label: 'Golden Duck', note: 'Round tables' }],
              images: [image('lawn.jpg')],
            },
            'Start here.\n\n![](lawn.jpg)\n\n:::places'
          ),
        ],
      })
    );

    expect(issues).toEqual([{ file: 'src/content/places/pier.md', message: 'invalid seo' }]);
    expect(catalog.posts).toEqual([
      {
        slug: 'welcome-lunch',
        areas: [
          { slug: 'testville', name: 'Testville' },
          { slug: 'harbor', name: 'Harbor' },
        ],
        title: 'Title of welcome-lunch',
        description: 'Description of welcome-lunch',
        publishedAt: '2026-10-09',
        updatedAt: '2026-10-10',
        occasion: { key: 'coffee-catch-up', label: 'Coffee catch-up' },
        parameters: {
          time: { key: 'weekday-lunch', label: 'Weekday lunch' },
          venue_type: null,
          group_size: { key: 'large', label: 'Big group, 7 or more' },
          budget: null,
        },
        mainKeyword: 'team welcome lunch',
        places: [{ placeId: 'ChIJ1', label: 'Golden Duck', note: 'Round tables' }],
        placesTitle: 'Our picks in Harbor',
        source: {
          kind: 'markdown',
          markdown: 'Start here.\n\n![](lawn.jpg)\n\n:::places\n',
          images: [lawn],
        },
      },
    ]);
  });

  it('drops each bad post file and says why, keeping the rest', () => {
    const longest = 'a'.repeat(80);
    const repo = content({
      places,
      posts: [
        postFile('boston-dinner', { city: 'boston' }),
        postFile('pier-lunch', { city: 'testville', town: 'pier' }),
        postFile('pier-dinner', { city: 'pier' }),
        postFile('orphan', { town: 'harbor' }),
        postFile('nowhere', { city: 'Testville' }),
        { name: 'no-front-matter.md', text: 'Just a body.\n' },
        { name: 'bad-yaml.md', text: '---\nnote: A cafe: near the park\n---\nBody\n' },
        { name: 'a-list.md', text: '---\n- title\n---\nBody\n' },
        postFile('brunch', { occasion: 'brunch' }),
        postFile('sushi', { venue_type: 'sushi-bar' }),
        postFile('big-group', { group_size: 7 }),
        postFile('Upper'),
        postFile(`${longest}b`),
        postFile(longest),
        postFile('stale', { updated_at: '2026-13-45' }),
        postFile('undated', { published_at: null }),
        postFile('untitled', { title: ' ' }),
        postFile('undescribed', { description: undefined }),
        postFile('lunch', {
          places: [
            { label: 'No id' },
            { place_id: 'ChIJ2', label: '  ' },
            { place_id: 'ChIJ3', label: 'Kept' },
            { place_id: 'ChIJ3', label: 'Listed twice' },
            'a place',
          ],
        }),
      ],
    });

    expect(skipped(repo)).toEqual([
      'src/content/places/pier.md: invalid seo',
      'src/content/posts/boston-dinner.md: city "boston" has no place file, src/content/places/boston.md',
      'src/content/posts/pier-lunch.md: town "pier" has no place file, src/content/places/testville/pier.md',
      'src/content/posts/pier-dinner.md: city "pier" has a place file the site skips, src/content/places/pier.md',
      'src/content/posts/orphan.md: town is set without a city',
      'src/content/posts/nowhere.md: invalid city "Testville"',
      'src/content/posts/no-front-matter.md: no front matter between two --- lines at the top',
      'src/content/posts/bad-yaml.md: front matter is not valid YAML: Nested mappings are not allowed in compact mappings at line 1, column 7:',
      'src/content/posts/a-list.md: front matter is not a YAML mapping of fields',
      'src/content/posts/brunch.md: unknown occasion "brunch"',
      'src/content/posts/sushi.md: unknown venue_type "sushi-bar"',
      'src/content/posts/big-group.md: unknown group_size 7',
      'src/content/posts/Upper.md: invalid slug "Upper"',
      `src/content/posts/${longest}b.md: slug is longer than 80 characters`,
      'src/content/posts/stale.md: invalid updated_at',
      'src/content/posts/undated.md: invalid published_at',
      'src/content/posts/untitled.md: missing title',
      'src/content/posts/undescribed.md: missing description',
      'src/content/posts/lunch.md: places[0]: missing place_id',
      'src/content/posts/lunch.md: places[1]: missing label',
      'src/content/posts/lunch.md: places[3]: repeats "ChIJ3"',
      'src/content/posts/lunch.md: places[4]: not an object',
    ]);
    expect(
      parseCatalog(repo).catalog.posts.map(({ slug, places }) => [
        slug,
        places.map((place) => place.placeId),
      ])
    ).toEqual([
      [longest, []],
      ['lunch', ['ChIJ3']],
    ]);
  });
});

describe('parseCatalog on taxonomy.yaml', () => {
  it('reads each list into typed terms', () => {
    const { catalog, issues } = parseCatalog(content({}));
    expect(issues).toEqual([]);
    expect(catalog.taxonomy).toEqual({
      occasions: [
        { key: 'team-welcome', label: 'Team welcome', times: [], venueTypes: [], groupSizes: [] },
        {
          key: 'coffee-catch-up',
          label: 'Coffee catch-up',
          times: ['weekday-lunch'],
          venueTypes: [],
          groupSizes: ['large'],
        },
      ],
      times: [{ key: 'weekday-lunch', label: 'Weekday lunch' }],
      venueTypes: [
        {
          key: 'chinese-restaurant',
          label: 'Chinese restaurant',
          googleType: 'chinese_restaurant',
        },
      ],
      groupSizes: [{ key: 'large', label: 'Big group, 7 or more' }],
      budgets: [{ key: 'moderate', label: 'Mid-range', priceLevel: 'PRICE_LEVEL_MODERATE' }],
    });
  });

  it('says why a file is not a taxonomy at all', () => {
    expect(skipped(content({ taxonomyText: 'occasions: [' }))).toEqual([
      'src/content/taxonomy.yaml: not valid YAML: Flow sequence in block collection must be sufficiently indented and end with a ] at line 1, column 13:',
    ]);
    expect(skipped(content({ taxonomyText: '- occasions' }))).toEqual([
      'src/content/taxonomy.yaml: not a YAML mapping of lists',
    ]);
    expect(
      skipped(
        content({ taxonomyText: stringify({ ...repoTaxonomy, budgets: undefined, prices: [] }) })
      )
    ).toEqual([
      'src/content/taxonomy.yaml: unknown list "prices"',
      'src/content/taxonomy.yaml: "budgets" is not a list',
    ]);
  });

  it('drops each value that breaks the schema, and a post that names a dropped key', () => {
    const [welcome, coffee] = repoTaxonomy.occasions;
    const [chinese] = repoTaxonomy.venue_types;
    const [moderate] = repoTaxonomy.budgets;
    const repo = content({
      taxonomyText: stringify({
        ...repoTaxonomy,
        occasions: [
          welcome,
          { ...coffee, times: ['late-night', 'weekday-lunch'], group_sizes: 'large' },
          { ...welcome, key: 'Team Welcome' },
          { ...welcome, label: '' },
          welcome,
          { ...welcome, key: 'farewell', note: 'Retired' },
          'birthday',
        ],
        times: [...repoTaxonomy.times, { key: 'late-lunch' }],
        venue_types: [chinese, { ...chinese, key: 'cafe', google_type: 'Cafe' }],
        budgets: [moderate, { ...moderate, key: 'free', price_level: 'PRICE_LEVEL_FREE' }],
      }),
      posts: [postFile('free-lunch', { budget: 'free' })],
    });

    expect(skipped(repo)).toEqual([
      'src/content/taxonomy.yaml: times[1]: missing label',
      'src/content/taxonomy.yaml: venue_types[1]: invalid google_type "Cafe"',
      'src/content/taxonomy.yaml: budgets[1]: invalid price_level "PRICE_LEVEL_FREE"',
      'src/content/taxonomy.yaml: occasions[1]: unknown time "late-night"',
      'src/content/taxonomy.yaml: occasions[1]: group_sizes is not a list',
      'src/content/taxonomy.yaml: occasions[2]: invalid key "Team Welcome"',
      'src/content/taxonomy.yaml: occasions[3]: missing label',
      'src/content/taxonomy.yaml: occasions[4]: repeats "team-welcome"',
      'src/content/taxonomy.yaml: occasions[5]: unknown field "note"',
      'src/content/taxonomy.yaml: occasions[6]: not an object',
      'src/content/posts/free-lunch.md: unknown budget "free"',
    ]);
    expect(parseCatalog(repo).catalog.taxonomy).toEqual({
      occasions: [
        { key: 'team-welcome', label: 'Team welcome', times: [], venueTypes: [], groupSizes: [] },
        {
          key: 'coffee-catch-up',
          label: 'Coffee catch-up',
          times: ['weekday-lunch'],
          venueTypes: [],
          groupSizes: [],
        },
      ],
      times: [{ key: 'weekday-lunch', label: 'Weekday lunch' }],
      venueTypes: [
        {
          key: 'chinese-restaurant',
          label: 'Chinese restaurant',
          googleType: 'chinese_restaurant',
        },
      ],
      groupSizes: [{ key: 'large', label: 'Big group, 7 or more' }],
      budgets: [{ key: 'moderate', label: 'Mid-range', priceLevel: 'PRICE_LEVEL_MODERATE' }],
    });
  });
});

describe('parseCatalog on keywords.yaml', () => {
  it('reads each phrase with its occasion and note, or null', () => {
    const { catalog, issues } = parseCatalog(
      content({
        keywordsText: stringify([
          { phrase: 'where to meet' },
          { phrase: 'coffee meeting spot', occasion: 'coffee-catch-up', note: 'Asked by Pat' },
          { phrase: 'team welcome lunch', occasion: null, note: '' },
        ]),
      })
    );
    expect(issues).toEqual([]);
    expect(catalog.keywords).toEqual([
      { phrase: 'where to meet', occasion: null, note: null },
      { phrase: 'coffee meeting spot', occasion: 'coffee-catch-up', note: 'Asked by Pat' },
      { phrase: 'team welcome lunch', occasion: null, note: null },
    ]);
  });

  it('says why a file is not a list of keywords', () => {
    expect(skipped(content({ keywordsText: '- phrase: [' }))).toEqual([
      'src/content/keywords.yaml: not valid YAML: Flow sequence in block collection must be sufficiently indented and end with a ] at line 1, column 12:',
    ]);
    expect(skipped(content({ keywordsText: 'phrase: where to meet\n' }))).toEqual([
      'src/content/keywords.yaml: not a YAML list of keywords',
    ]);
  });

  it('drops each entry that breaks the schema or repeats a phrase, and says why', () => {
    const repo = content({
      keywordsText: stringify([
        { phrase: 'Date  Spot' },
        'first date spot',
        { phrase: 'date spot near me', notes: 'Typo' },
        { phrase: ' ' },
        { occasion: 'team-welcome' },
        { phrase: 'date spot' },
        { phrase: 'brunch spot', occasion: 'brunch' },
        { phrase: 'team lunch', note: 7 },
        { phrase: 'coffee meeting spot', occasion: 'coffee-catch-up' },
      ]),
    });
    expect(skipped(repo)).toEqual([
      'src/content/keywords.yaml: [1]: not an object',
      'src/content/keywords.yaml: [2]: unknown field "notes"',
      'src/content/keywords.yaml: [3]: missing phrase',
      'src/content/keywords.yaml: [4]: missing phrase',
      'src/content/keywords.yaml: [5]: repeats "Date  Spot"',
      'src/content/keywords.yaml: [6]: unknown occasion "brunch"',
      'src/content/keywords.yaml: [7]: invalid note 7',
    ]);
    expect(parseCatalog(repo).catalog.keywords.map(({ phrase }) => phrase)).toEqual([
      'Date  Spot',
      'coffee meeting spot',
    ]);
  });
});
