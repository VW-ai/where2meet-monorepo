import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/(landing)/blog/content.json/route';
import { FIXTURE_FILES, type FixtureFile } from '@/features/blog/__fixtures__/content-files';

const disk = vi.hoisted(() => ({ files: [] as FixtureFile[] }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const { withContentFiles } = await import('@/features/blog/__fixtures__/content-files');
  return withContentFiles(await importOriginal(), () => disk.files);
});

const TAXONOMY = `occasions:
  - key: team-meeting
    label: Team meeting
    times: [weekday-lunch]
    venue_types: []
    group_sizes: [small]
  - key: team-welcome
    label: Team welcome
    times: [weekday-lunch, after-work]
    venue_types: [park]
    group_sizes: [large]
  - key: group-dinner
    label: Group dinner
    times: [after-work]
    venue_types: [korean-restaurant]
    group_sizes: [small, large]
times:
  - key: weekday-lunch
    label: Weekday lunch
  - key: after-work
    label: After work
venue_types:
  - key: park
    label: Park
    google_type: park
  - key: korean-restaurant
    label: Korean restaurant
    google_type: korean_restaurant
group_sizes:
  - key: small
    label: Small group, 3 to 6
  - key: large
    label: Big group, 7 or more
budgets:
  - key: inexpensive
    label: Inexpensive
    price_level: PRICE_LEVEL_INEXPENSIVE
  - key: moderate
    label: Mid-range
    price_level: PRICE_LEVEL_MODERATE
`;

const KEYWORDS = `- phrase: team welcome lunch
  occasion: team-welcome
- phrase: where to meet
  note: The phrase the homepage targets
`;

const WRITING_RULES = '# Writing rules\n\nWrite short sentences.\n';

const CONTENT = {
  version: 1,
  generated_at: '2026-10-10T12:00:00Z',
  taxonomy: {
    occasions: [
      {
        key: 'team-meeting',
        label: 'Team meeting',
        times: ['weekday-lunch'],
        venue_types: [],
        group_sizes: ['small'],
      },
      {
        key: 'team-welcome',
        label: 'Team welcome',
        times: ['weekday-lunch', 'after-work'],
        venue_types: ['park'],
        group_sizes: ['large'],
      },
      {
        key: 'group-dinner',
        label: 'Group dinner',
        times: ['after-work'],
        venue_types: ['korean-restaurant'],
        group_sizes: ['small', 'large'],
      },
    ],
    times: [
      { key: 'weekday-lunch', label: 'Weekday lunch' },
      { key: 'after-work', label: 'After work' },
    ],
    venue_types: [
      { key: 'park', label: 'Park', google_type: 'park' },
      { key: 'korean-restaurant', label: 'Korean restaurant', google_type: 'korean_restaurant' },
    ],
    group_sizes: [
      { key: 'small', label: 'Small group, 3 to 6' },
      { key: 'large', label: 'Big group, 7 or more' },
    ],
    budgets: [
      { key: 'inexpensive', label: 'Inexpensive', price_level: 'PRICE_LEVEL_INEXPENSIVE' },
      { key: 'moderate', label: 'Mid-range', price_level: 'PRICE_LEVEL_MODERATE' },
    ],
  },
  keywords: [
    { phrase: 'team welcome lunch', occasion: 'team-welcome', note: null },
    { phrase: 'where to meet', occasion: null, note: 'The phrase the homepage targets' },
  ],
  places: [
    {
      path: '/blog/new-york',
      kind: 'city',
      slug: 'new-york',
      name: 'New York',
      center: { lat: 40.7128, lng: -74.006 },
    },
    {
      path: '/blog/new-york/midtown',
      kind: 'town',
      slug: 'midtown',
      city: 'new-york',
      name: 'Midtown',
      center: { lat: 40.7549, lng: -73.984 },
    },
  ],
  posts: [
    {
      path: '/blog/how-to-pick-a-restaurant-for-a-group-dinner',
      title: 'How to pick a restaurant for a group dinner',
      source: 'mdx',
      occasion: 'group-dinner',
      time: null,
      venue_type: null,
      group_size: null,
      budget: null,
      main_keyword: null,
      city: null,
      town: null,
      published_at: '2026-10-08',
      updated_at: '2026-10-08',
    },
    {
      path: '/blog/how-to-pick-a-date-spot',
      title: 'How to pick a date spot you can both reach',
      source: 'mdx',
      occasion: 'date-night',
      time: null,
      venue_type: null,
      group_size: null,
      budget: null,
      main_keyword: null,
      city: null,
      town: null,
      published_at: '2026-10-08',
      updated_at: '2026-10-08',
    },
    {
      path: '/blog/new-york/midtown/a-team-welcome-lunch-in-bryant-park',
      title: 'A team welcome lunch in Bryant Park',
      source: 'markdown',
      occasion: 'team-welcome',
      time: 'weekday-lunch',
      venue_type: 'park',
      group_size: 'large',
      budget: null,
      main_keyword: 'team welcome lunch bryant park',
      city: 'new-york',
      town: 'midtown',
      published_at: '2026-10-08',
      updated_at: '2026-10-08',
    },
    {
      path: '/blog/how-to-plan-a-team-welcome-lunch',
      title: 'How to plan a team welcome lunch',
      source: 'markdown',
      occasion: 'team-welcome',
      time: null,
      venue_type: null,
      group_size: 'large',
      budget: null,
      main_keyword: 'team welcome lunch',
      city: null,
      town: null,
      published_at: '2026-10-08',
      updated_at: '2026-10-08',
    },
    {
      path: '/blog/new-york/group-dinner-spots-near-herald-square',
      title: 'Group dinner spots near Herald Square',
      source: 'markdown',
      occasion: 'group-dinner',
      time: 'after-work',
      venue_type: 'korean-restaurant',
      group_size: 'large',
      budget: 'moderate',
      main_keyword: 'group dinner near herald square',
      city: 'new-york',
      town: null,
      published_at: '2026-10-06',
      updated_at: '2026-10-07',
    },
    {
      path: '/blog/how-to-plan-a-weekend-hangout-with-friends',
      title: 'How to plan a weekend hangout with friends',
      source: 'mdx',
      occasion: 'weekend-hangout',
      time: null,
      venue_type: null,
      group_size: null,
      budget: null,
      main_keyword: null,
      city: null,
      town: null,
      published_at: '2026-10-05',
      updated_at: '2026-10-08',
    },
    {
      path: '/blog/new-york/midtown/quiet-places-for-a-small-team-meeting',
      title: 'Quiet places for a small team meeting in Midtown',
      source: 'markdown',
      occasion: 'team-meeting',
      time: 'weekday-lunch',
      venue_type: null,
      group_size: 'small',
      budget: 'inexpensive',
      main_keyword: 'small team meeting midtown',
      city: 'new-york',
      town: 'midtown',
      published_at: '2026-10-05',
      updated_at: '2026-10-07',
    },
    {
      path: '/blog/how-to-choose-a-team-meeting-location',
      title: 'How to choose a team meeting location',
      source: 'mdx',
      occasion: 'team-meeting',
      time: null,
      venue_type: null,
      group_size: null,
      budget: null,
      main_keyword: null,
      city: null,
      town: null,
      published_at: '2026-10-04',
      updated_at: '2026-10-08',
    },
  ],
  writing_rules: '# Writing rules\n\nWrite short sentences.\n',
};

beforeEach(() => {
  disk.files = [
    ...FIXTURE_FILES,
    { path: 'src/content/taxonomy.yaml', text: TAXONOMY },
    { path: 'src/content/keywords.yaml', text: KEYWORDS },
    { path: 'docs/writing-rules.md', text: WRITING_RULES },
  ];
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-10T12:00:00.250Z'));
});

afterEach(() => {
  disk.files = [];
  vi.useRealTimers();
});

describe('GET /blog/content.json', () => {
  it('publishes the repo content for the Control Panel as noindex JSON, in the spec key order', async () => {
    const response = await GET();

    expect(Object.fromEntries(response.headers)).toEqual({
      'content-type': 'application/json',
      'x-robots-tag': 'noindex',
    });
    const text = await response.text();
    expect(JSON.parse(text)).toEqual(CONTENT);
    expect(text).toBe(JSON.stringify(CONTENT));
  });
});
