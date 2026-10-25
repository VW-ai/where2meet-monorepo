import { describe, expect, it } from 'vitest';
import { howToWords, titleEcho, wordSimilarity } from '../repetition';

/** Each sitemap page's title and description in the 2026-10-22 SEO audit's `parsed.json`. */
const AUDITED_PAGES: [path: string, title: string, description: string][] = [
  [
    '/',
    'Plan Where to Meet With Your Group',
    'Plan where to meet with your group. Everyone adds where they are coming from, you compare travel times on a map, then vote on a convenient spot. No sign-up.',
  ],
  [
    '/about',
    'About',
    'Where2Meet is a free web app where a group plans where to meet together: everyone adds where they are coming from, compares travel times and votes on a convenient spot.',
  ],
  [
    '/blog',
    'Blog',
    'Guides to planning where to meet with your group: compare travel times, choose a venue that suits the occasion, and agree on a place together.',
  ],
  [
    '/blog/new-york',
    'Where to meet up in New York City',
    'Where to meet up in New York City, with the Manhattan areas and stations where many subway lines stop, and the trains that change late at night.',
  ],
  [
    '/blog/new-york/basketball-courts-near-me-free-indoor-nyc',
    'Free indoor basketball courts near me in NYC',
    'Find free indoor basketball courts near me in Manhattan, with six NYC Parks gyms that are free under 25, their hours, stations and how to join.',
  ],
  [
    '/blog/new-york/date-night-bars-manhattan',
    'Date night bars in Manhattan',
    'Date night bars in Manhattan a few minutes from the subway, including a 64th-floor cocktail bar and two jazz clubs, with hours and the late trains home.',
  ],
  [
    '/blog/new-york/lower-manhattan',
    'Where to meet up in Lower Manhattan',
    'Where to meet up in Lower Manhattan, around Fulton St, the World Trade Center and the Financial District, with PATH, ferry and late-night subway notes.',
  ],
  [
    '/blog/new-york/lower-manhattan/bathhouse-with-friends-lower-manhattan',
    'Bathhouse with friends in Lower Manhattan',
    'Plan a bathhouse with friends in Lower Manhattan, with six saunas, baths and spas near the subway, plus booking tips for groups and the late trains home.',
  ],
  [
    '/blog/new-york/lower-manhattan/how-to-pick-a-restaurant-for-a-group-dinner',
    'Group dinner spots in Lower Manhattan',
    'Group dinner spots in Lower Manhattan, with eight restaurants and bars near Fulton St, Wall St and Stone Street, and how everyone gets home after.',
  ],
  [
    '/blog/new-york/lower-manhattan/where-to-celebrate-graduation-lower-manhattan',
    'Where to celebrate graduation in downtown NYC',
    'Where to celebrate graduation in Lower Manhattan, with eight restaurants and rooftops near the subway, plus booking tips for families and the late trains.',
  ],
  [
    '/blog/new-york/midtown',
    'Where to meet up in Midtown Manhattan',
    'Where to meet up in Midtown Manhattan near Times Square, Bryant Park or Grand Central, with the trains that still run late at night and on weekends.',
  ],
  [
    '/blog/new-york/midtown/how-to-choose-a-team-meeting-location',
    'Where to hold a team meeting in Midtown',
    'Where to hold a team meeting in Midtown, with eight rooms, cafes, restaurants and bars near Times Square, Grand Central, Bryant Park and Herald Square.',
  ],
  [
    '/blog/new-york/pickup-basketball-new-york',
    'Where to play pickup basketball in New York',
    'Where to play pickup basketball in New York, with seven outdoor courts near the subway in Lower Manhattan, plus a rain backup and the trains home.',
  ],
  [
    '/blog/new-york/team-meeting-location-manhattan',
    'Team meeting location ideas across Manhattan',
    'Team meeting location ideas across Manhattan, with seven rooms and restaurants in Lower Manhattan, SoHo, Union Square, NoMad and near Penn Station.',
  ],
  [
    '/blog/new-york/union-square',
    'Where to meet up near Union Square, NYC',
    'Where to meet up near Union Square in Manhattan, where eight subway lines stop at 14 St, plus the Greenmarket days and the trains that skip it at night.',
  ],
  [
    '/blog/new-york/union-square/how-to-pick-a-date-spot',
    'Where to go on a date near Union Square',
    'Where to go on a date near Union Square, with eight cafes, bars and restaurants a short walk from eight subway lines, plus the trains that run late.',
  ],
  [
    '/blog/new-york/upper-west-side',
    'Where to meet up on the Upper West Side',
    'Where to meet up on the Upper West Side, from Lincoln Center to the Museum of Natural History, with the Broadway and Central Park West trains and buses.',
  ],
  [
    '/blog/new-york/upper-west-side/how-to-plan-a-weekend-hangout-with-friends',
    'Weekend hangout spots on the Upper West Side',
    'Weekend hangout spots on the Upper West Side, with eight places to eat, drink and spend a rainy afternoon, plus the trains that change on weekends.',
  ],
  [
    '/blog/new-york/where-to-celebrate-birthday-new-york',
    'Where to celebrate a birthday in New York',
    'Where to celebrate a birthday in New York, with eight picks near the subway, from ping pong to a rooftop brunch, plus booking and late-train tips.',
  ],
  [
    '/blog/new-york/where-to-study-with-friends-new-york',
    'Where to study with friends in New York',
    'Where to study with friends in New York, with seven Manhattan cafes good for laptops near the subway, plus their Wi-Fi, hours and late options.',
  ],
  ['/contact', 'Contact', 'Email victorzhang0218@gmail.com. We reply within a couple of days.'],
  [
    '/faq',
    'FAQ',
    'Answers about planning where to meet with Where2Meet: accounts, sharing a link, choosing a starting point, travel modes, voting and cost.',
  ],
];

describe('titleEcho', () => {
  it('flags the 18 of 22 descriptions the 2026-10-22 audit counted as repeating the title', () => {
    const echoed = AUDITED_PAGES.filter(([, title, description]) =>
      titleEcho(title, description)
    ).map(([path]) => path);
    expect(echoed).toEqual(
      AUDITED_PAGES.map(([path]) => path).filter(
        (path) => !['/about', '/blog', '/contact', '/faq'].includes(path)
      )
    );
  });

  it('returns the title words a description opens with, and null when they come later', () => {
    expect(
      titleEcho(
        'Bathhouse with friends in Lower Manhattan',
        'Plan a bathhouse with friends in Lower Manhattan, with six saunas.'
      )
    ).toBe('bathhouse with friends in');
    expect(
      titleEcho('Where to meet up in Union Square', 'Where to meet up around Union Square.')
    ).toBe('where to meet up');
    expect(
      titleEcho('How to plan a group dinner after work', 'Plan a group dinner after work.')
    ).toBe('plan a group dinner');
    expect(
      titleEcho(
        'Where to study with friends in New York',
        'Seven Manhattan cafes good for laptops, to settle where to study with friends.'
      )
    ).toBeNull();
    expect(
      titleEcho('How to plan a team welcome lunch', 'Sample post: pick a team welcome lunch spot.')
    ).toBeNull();
  });
});

describe('titleEcho on a title under 4 words', () => {
  it('flags only a description that starts with the whole title', () => {
    expect(titleEcho('Pickleball', 'Pickleball at six courts near the subway.')).toBe('pickleball');
    expect(titleEcho('Pickleball', 'Play pickleball at six courts near the subway.')).toBeNull();
    expect(titleEcho('Date night bars', 'Date night bars near the subway.')).toBe(
      'date night bars'
    );
    expect(titleEcho('Date night bars', 'Eight date night bars near the subway.')).toBeNull();
  });
});

describe('howToWords', () => {
  it('reads the section the same with CRLF or LF line endings', () => {
    const post =
      'Intro.\n\n## How to do it in Where2Meet\n\nShare the [link](/) today.\n\n## Common questions\n\nA question.\n';
    expect(howToWords(post)).toEqual(['share', 'the', 'link', 'today.']);
    expect(howToWords(post.replaceAll('\n', '\r\n'))).toEqual(['share', 'the', 'link', 'today.']);
  });
});

describe('wordSimilarity', () => {
  it("scores as Python's difflib.SequenceMatcher ratio does", () => {
    expect(wordSimilarity(['a', 'b', 'c', 'd'], ['b', 'c', 'd', 'e'])).toBe(0.75);
    expect(wordSimilarity(['link', 'plan', 'link', 'plan'], ['plan', 'vote', 'link', 'vote'])).toBe(
      0.25
    );
    expect(wordSimilarity(['vote'], [])).toBe(0);
    expect(wordSimilarity([], [])).toBe(1);
  });
});
