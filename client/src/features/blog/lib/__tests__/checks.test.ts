import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkContent, formatProblem, type ImageHead } from '../checks';
import type { ContentFile } from '../content-file';
import { fixtureContent } from '../../__fixtures__/content-files';

const NAME = 'group-dinner-after-work.md';
const example: ContentFile = {
  name: NAME,
  text: readFileSync(path.join(__dirname, '../../__fixtures__/posts', NAME), 'utf8'),
};
const FILE = `src/content/posts/${NAME}`;

const COVER_URL =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Koreatown%2C_Manhattan_%2851877264332%29.jpg/1280px-Koreatown%2C_Manhattan_%2851877264332%29.jpg';
const FULTON_URL =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/Fulton_Center_-_Full_%2848126530611%29.jpg/1280px-Fulton_Center_-_Full_%2848126530611%29.jpg';
const ATLANTIC_URL =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Barclays_Center_entrance_vc.jpg/1280px-Barclays_Center_entrance_vc.jpg';

const ATLANTIC_IMAGE = `  - file_name: atlantic-avenue-barclays-center-station-entrance.jpg
    source_url: ${ATLANTIC_URL}
    page_url: https://commons.wikimedia.org/wiki/File:Barclays_Center_entrance_vc.jpg
    width: 1280
    height: 852
    alt: The plaza entrance to the Atlantic Avenue Barclays Center subway station in Brooklyn, with signs for its lines
    caption: The plaza entrance to the Atlantic Av-Barclays Ctr station in Brooklyn
    author: Metropolitan Transportation Authority of the State of New York
    license: CC BY 2.0
    cropped: false
`;

/** The example's main keyword, spelled another way, and one more. */
const KEYWORDS =
  '- phrase: Group  Dinner after work\n  occasion: group-dinner\n- phrase: group dinner\n';

/** The posts with the fixture's places, so a post can be local to New York or Midtown. */
function check(
  posts: readonly ContentFile[],
  heads: ReadonlyMap<string, ImageHead> = new Map()
): string[] {
  return checkContent({ ...fixtureContent(), keywordsText: KEYWORDS, posts }, { heads }).map(
    formatProblem
  );
}

function edited(edits: readonly [from: string, to: string][], name = NAME): ContentFile {
  let text = example.text;
  for (const [from, to] of edits) {
    if (!text.includes(from)) throw new Error(`the example has no ${JSON.stringify(from)}`);
    text = text.replaceAll(from, to);
  }
  return { name, text };
}

describe('checkContent on a post', () => {
  it('passes the example, and drops it under a taken name with only that problem', () => {
    const heads = new Map<string, ImageHead>([
      [COVER_URL, { status: 200, bytes: 486_621, contentType: 'image/jpeg' }],
      [FULTON_URL, { status: 200, bytes: 389_396, contentType: 'image/jpeg' }],
      [ATLANTIC_URL, { status: 200, bytes: 301_205, contentType: 'image/jpeg' }],
    ]);
    expect(check([example], heads)).toEqual([]);
    expect(check([{ ...example, name: 'how-to-pick-a-date-spot.md' }], heads)).toEqual([
      'src/content/posts/how-to-pick-a-date-spot.md: fields: slug "how-to-pick-a-date-spot" is taken by an MDX post',
    ]);
  });

  describe('fields', () => {
    it('reports front matter that is not YAML', () => {
      const file = edited([
        [
          'title: How to plan a group dinner after work',
          'title: Group dinner after work: how to plan it',
        ],
      ]);
      expect(check([file])).toEqual([
        `${FILE}: fields: front matter is not valid YAML: Nested mappings are not allowed in compact mappings at line 1, column 8:`,
      ]);
    });

    it('reports what the parser drops the post for', () => {
      expect(check([edited([['published_at: 2026-10-10', 'published_at: 10/10/2026']])])).toEqual([
        `${FILE}: fields: invalid published_at`,
      ]);
    });

    it('reports a parameter key the taxonomy does not have', () => {
      expect(check([edited([['venue_type: null', 'venue_type: sushi-bar']])])).toEqual([
        `${FILE}: fields: unknown venue_type "sushi-bar"`,
      ]);
    });

    it('reports a photo the parser drops, and the images rule counts what is left', () => {
      const file = edited([
        [
          'author: Ajay Suresh\n    license: CC BY 2.0\n    cropped: false\n  - file_name: atlantic',
          'author: Ajay Suresh\n    license: CC BY-SA 4.0\n    cropped: false\n  - file_name: atlantic',
        ],
      ]);
      expect(check([file])).toEqual([
        `${FILE}: fields: images[1]: license "CC BY-SA 4.0" is not allowed`,
        `${FILE}: images: the post has 2 usable images; it needs at least 3, a cover and two for the body`,
        `${FILE}: images: the body places ![](fulton-center-lower-manhattan.jpg), but no usable image has that file_name`,
      ]);
    });

    it('reports a field the format does not have', () => {
      const file = edited([
        [
          'license: CC BY 2.0\n    cropped: false\n  - file_name: fulton',
          'license: CC BY 2.0\n    license_url: https://creativecommons.org/licenses/by/2.0/\n    cropped: false\n  - file_name: fulton',
        ],
      ]);
      expect(check([file])).toEqual([
        `${FILE}: fields: images[0]: unknown field "license_url"; an image has only file_name, source_url, page_url, width, height, alt, caption, author, license and cropped`,
      ]);
    });

    it('reports a field the parser would read past with the wrong type', () => {
      const file = edited([
        [
          'license: CC BY 2.0\n    cropped: false\n  - file_name: fulton',
          'license: CC BY 2.0\n    cropped: no\n  - file_name: fulton',
        ],
      ]);
      expect(check([file])).toEqual([
        `${FILE}: fields: images[0]: cropped is "no"; it must be true or false`,
      ]);
    });

    it('needs a main keyword', () => {
      expect(
        check([edited([['main_keyword: group dinner after work', 'main_keyword: ""']])])
      ).toEqual([`${FILE}: fields: main_keyword is ""; it must be non-empty text`]);
    });
  });

  it('keeps the photo route free', () => {
    expect(check([{ ...example, name: 'images.md' }])).toEqual([
      'src/content/posts/images.md: fields: slug "images" is taken by the photo route',
    ]);
  });

  it('is the only check on a file the site drops', () => {
    const file = edited([
      ['published_at: 2026-10-10', 'published_at: 10/10/2026'],
      ['## Common questions', '## Questions people ask'],
    ]);
    expect(check([file])).toEqual([`${FILE}: fields: invalid published_at`]);
  });

  it('reports a local post whose city has no place file', () => {
    expect(check([edited([['city: null', 'city: boston']])])).toEqual([
      `${FILE}: fields: city "boston" has no place file, src/content/places/boston.md`,
    ]);
  });

  describe('word-count', () => {
    it('holds a general post to 700 to 1,000 words', () => {
      const start = example.text.indexOf('## What time should you book the table?');
      const end = example.text.indexOf('## How will everyone get home?');
      const file = edited([[example.text.slice(start, end), '']]);
      expect(check([file])).toEqual([
        `${FILE}: word-count: the body has 689 words; a general post needs 700 to 1,000`,
      ]);
    });

    it('holds a local post to 400 to 800 words', () => {
      expect(check([edited([['city: null', 'city: new-york']])])).toEqual([
        `${FILE}: word-count: the body has 925 words; a local post needs 400 to 800`,
      ]);
    });
  });

  describe('places', () => {
    it('needs three places', () => {
      const elZason =
        '  - place_id: ChIJX0ngNbRbwokR2sNkLsVtQMY\n    label: El Zason\n    note: Mexican food on Atlantic Avenue in Brooklyn. The Atlantic Av-Barclays Ctr station is about a 5-minute walk away, with the 2, 3, 4, 5, B, D, N, Q and R.\n';
      expect(check([edited([[elZason, '']])])).toEqual([
        `${FILE}: places: the post has 2 places; it needs at least 3`,
      ]);
    });

    it('needs a note of 12 words for each place', () => {
      const note =
        "note: A pub and restaurant among the Financial District's offices. The Fulton St station, where the 2, 3, 4, 5, A, C, J and Z stop, is about a 2-minute walk away.";
      expect(check([edited([[note, 'note: A pub near the Fulton St station.']])])).toEqual([
        `${FILE}: places: the note for "The Malt House" has 7 words; a place note needs at least 12`,
      ]);
    });
  });

  describe('images', () => {
    it('needs three usable images, and every photo line names one', () => {
      expect(check([edited([[ATLANTIC_IMAGE, '']])])).toEqual([
        `${FILE}: images: the post has 2 usable images; it needs at least 3, a cover and two for the body`,
        `${FILE}: images: the body places ![](atlantic-avenue-barclays-center-station-entrance.jpg), but no usable image has that file_name`,
      ]);
    });

    it('reports a photo line with a file name the post does not list', () => {
      const file = edited([['![](fulton-center-lower-manhattan.jpg)', '![](fulton-center.jpg)']]);
      expect(check([file])).toEqual([
        `${FILE}: images: the body places ![](fulton-center.jpg), but no usable image has that file_name`,
      ]);
    });

    it('keeps each file name to the first file that lists it', () => {
      const other = edited(
        [
          ['fulton-center-lower-manhattan.jpg', 'fulton-center-station.jpg'],
          ['atlantic-avenue-barclays-center-station-entrance.jpg', 'barclays-center-entrance.jpg'],
        ],
        'group-dinner-in-brooklyn.md'
      );
      expect(check([example, other])).toEqual([
        'src/content/posts/group-dinner-in-brooklyn.md: fields: images[0]: file_name "west-32nd-street-koreatown-manhattan.jpg" is already used',
        'src/content/posts/group-dinner-in-brooklyn.md: images: the post has 2 usable images; it needs at least 3, a cover and two for the body',
      ]);
    });
  });

  describe('image-size', () => {
    it.each<[string, ImageHead, string]>([
      [
        'an error status',
        { status: 404, bytes: 1_234, contentType: 'text/html' },
        'west-32nd-street-koreatown-manhattan.jpg: its source_url answered HTTP 404; it needs to load',
      ],
      [
        'a type that is not JPEG',
        { status: 200, bytes: 486_621, contentType: 'image/png' },
        'west-32nd-street-koreatown-manhattan.jpg: its source_url serves image/png; it needs image/jpeg',
      ],
      [
        'no size',
        { status: 200, bytes: null, contentType: 'image/jpeg' },
        'west-32nd-street-koreatown-manhattan.jpg: its source_url gives no size; the site caches only a photo it knows is at most 2,000,000 bytes',
      ],
      [
        'a photo over 2,000,000 bytes',
        { status: 200, bytes: 2_000_001, contentType: 'image/jpeg; charset=binary' },
        'west-32nd-street-koreatown-manhattan.jpg: its source_url serves 2,000,001 bytes; the site caches a photo only up to 2,000,000',
      ],
    ])('reports %s, and leaves unmeasured photos alone', (_, head, message) => {
      expect(check([example], new Map([[COVER_URL, head]]))).toEqual([
        `${FILE}: image-size: ${message}`,
      ]);
    });
  });

  it('holds the title to 60 characters with the suffix', () => {
    const file = edited([
      [
        'title: How to plan a group dinner after work',
        'title: How to plan a group dinner after work across town with coworkers',
      ],
    ]);
    expect(check([file])).toEqual([
      `${FILE}: title: the title is 77 characters with its " | Where2Meet" suffix; it needs at most 60`,
    ]);
  });

  it('holds the description to 120 to 155 characters', () => {
    const description =
      'description: Plan a group dinner after work that everyone can reach from the office, book a table that fits the latest finisher, and make the trip home easy.';
    const file = edited([
      [description, 'description: Plan a group dinner after work that everyone can reach.'],
    ]);
    expect(check([file])).toEqual([
      `${FILE}: description: the description is 55 characters; it needs 120 to 155`,
    ]);
  });

  describe('main-keyword', () => {
    it('needs a phrase from keywords.yaml', () => {
      const file = edited([
        ['main_keyword: group dinner after work', 'main_keyword: group dinner'],
        ['A group dinner after work goes best', 'A group dinner goes best'],
      ]);
      expect(check([file])).toEqual([]);
      expect(
        check([edited([['main_keyword: group dinner after work', 'main_keyword: dinner']])])
      ).toEqual([
        `${FILE}: main-keyword: the main keyword "dinner" is not a phrase in src/content/keywords.yaml; it must be one, so add it there or pick one of its phrases`,
      ]);
    });

    it('needs it in the title', () => {
      const file = edited([
        [
          'title: How to plan a group dinner after work',
          'title: How to plan an after-work dinner with coworkers',
        ],
      ]);
      expect(check([file])).toEqual([
        `${FILE}: main-keyword: the title does not say the main keyword "group dinner after work"; it must, as whole words`,
      ]);
    });

    it('needs it in the first two sentences of the body, not later', () => {
      const file = edited([
        ['A group dinner after work goes best', 'An evening out goes best'],
        [
          'One restaurant has to work for all of them on a weeknight.',
          'One group dinner after work has to suit all of them.',
        ],
      ]);
      expect(check([file])).toEqual([
        `${FILE}: main-keyword: the body's first two sentences do not say the main keyword "group dinner after work"; they must, as whole words`,
      ]);
    });
  });

  it('needs the required headings', () => {
    expect(check([edited([['## Common questions', '## Questions people ask']])])).toEqual([
      `${FILE}: headings: the body has no "## Common questions" heading; every post needs it`,
    ]);
  });

  describe('wording', () => {
    it('blocks a word starting with "fair" in the body', () => {
      const file = edited([['a short trip matters more', 'a short trip is fairer']]);
      expect(check([file])).toEqual([
        `${FILE}: wording: the body says "fairer"; write "convenient", and never a word starting with "fair" or "meet in the middle"`,
      ]);
    });

    it('reads a place note the way a reader sees it', () => {
      const file = edited([
        [
          'Korean barbecue in Koreatown,',
          'Korean barbecue in Koreatown, to **meet in the** middle,',
        ],
      ]);
      expect(check([file])).toEqual([
        `${FILE}: wording: the note for "miss KOREA BBQ" says "meet in the middle"; write "convenient", and never a word starting with "fair" or "meet in the middle"`,
      ]);
    });
  });

  describe('style', () => {
    it('blocks a curly quote in the body', () => {
      expect(check([edited([["most people's way home", 'most people\u2019s way home']])])).toEqual([
        `${FILE}: style: the body has a curly quote; use straight quotes instead of "\u2019"`,
      ]);
    });

    it('blocks a dash in a caption', () => {
      const file = edited([
        [
          'caption: West 32nd Street in Koreatown, Manhattan',
          'caption: West 32nd Street \u2014 Koreatown, Manhattan',
        ],
      ]);
      expect(check([file])).toEqual([
        `${FILE}: style: the caption of west-32nd-street-koreatown-manhattan.jpg has an em dash; use a period or a comma instead of "\u2014"`,
      ]);
    });
  });

  it('needs updated_at on or after published_at', () => {
    expect(check([edited([['updated_at: 2026-10-10', 'updated_at: 2026-10-09']])])).toEqual([
      `${FILE}: dates: updated_at 2026-10-09 is before published_at 2026-10-10; it must be on or after it`,
    ]);
  });
});

describe('checkContent on a place', () => {
  const CITY = 'src/content/places/new-york.md';
  const TOWN = 'src/content/places/new-york/midtown.md';
  const [newYork, midtown] = fixtureContent().places;
  const CITY_IMAGE_URL =
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Midtown_Manhattan_2019.jpg/1280px-Midtown_Manhattan_2019.jpg';

  function checkPlaces(
    places: readonly ContentFile[],
    heads: ReadonlyMap<string, ImageHead> = new Map()
  ): string[] {
    return checkContent({ ...fixtureContent(), places, posts: [] }, { heads }).map(formatProblem);
  }

  function editedPlace(file: ContentFile, edits: readonly [from: string, to: string][]) {
    let text = file.text;
    for (const [from, to] of edits) {
      if (!text.includes(from)) throw new Error(`${file.name} has no ${JSON.stringify(from)}`);
      text = text.replaceAll(from, to);
    }
    return { ...file, text };
  }

  it('passes the fixture city and town', () => {
    expect([newYork.name, midtown.name]).toEqual(['new-york.md', 'new-york/midtown.md']);
    expect(checkPlaces([newYork, midtown])).toEqual([]);
  });

  it('reports a field a city, a town or its image does not have', () => {
    const city = editedPlace(newYork, [
      [
        '  license: CC0\n',
        '  license: CC0\n  license_url: https://creativecommons.org/publicdomain/zero/1.0/\n',
      ],
    ]);
    const town = editedPlace(midtown, [['name: Midtown\n', 'name: Midtown\nregion: NY\n']]);
    expect(checkPlaces([city, town])).toEqual([
      `${CITY}: fields: image: unknown field "license_url"; an image has only file_name, source_url, page_url, width, height, alt, caption, author, license and cropped`,
      `${TOWN}: fields: unknown field "region"; a town has only name, center, updated_at, seo and image`,
    ]);
  });

  it('reports what the parser drops a city for, and drops its towns with it', () => {
    const city = editedPlace(newYork, [['country: US\n', '']]);
    expect(checkPlaces([city, midtown])).toEqual([
      `${CITY}: fields: missing country`,
      `${TOWN}: fields: city "new-york" has a place file the site skips, ${CITY}`,
    ]);
  });

  it('needs an intro of 60 words', () => {
    const town = editedPlace(midtown, [
      [
        "Midtown is where many New York offices are, so it's the default for anything work-related.",
        'Midtown is busy.',
      ],
      [
        ' Grand Central, Times Square and Herald Square stations put most of the city within one train, and Bryant Park sits between them as an easy landmark. Most of these posts are about weekday plans, like a team lunch, a quick meeting near the office or drinks after work, chosen so the whole group can arrive within a short walk of one station.',
        '',
      ],
    ]);
    expect(checkPlaces([newYork, town])).toEqual([
      `${TOWN}: intro: the intro has 7 words; a place page needs at least 60`,
    ]);
  });

  it('needs a "## Getting around" heading with 20 words of transit notes below it', () => {
    const noHeading = editedPlace(midtown, [['## Getting around\n\n', '']]);
    expect(checkPlaces([newYork, noHeading])).toEqual([
      `${TOWN}: getting-around: the body has no "## Getting around" heading; a place page needs it before its transit notes`,
    ]);
    const shortNotes = editedPlace(midtown, [
      [
        '_Sample copy._ Grand Central, Times Square and Herald Square stations serve most subway lines, and PATH and commuter trains stop nearby. Streets are busiest from 8 to 10 a.m. and 5 to 7 p.m.',
        'Take the subway.',
      ],
    ]);
    expect(checkPlaces([newYork, shortNotes])).toEqual([
      `${TOWN}: getting-around: the transit notes have 3 words; they need at least 20`,
    ]);
  });

  it('needs a usable image', () => {
    const town = editedPlace(midtown, [['license: Public domain', 'license: CC BY-SA 4.0']]);
    expect(checkPlaces([newYork, town])).toEqual([
      `${TOWN}: fields: image: license "CC BY-SA 4.0" is not allowed`,
      `${TOWN}: image: the page has no usable image; a place page needs one`,
    ]);
  });

  it('measures its image like a post photo, and leaves an unmeasured one alone', () => {
    const heads = new Map([
      [CITY_IMAGE_URL, { status: 404, bytes: 1_234, contentType: 'text/html' }],
    ]);
    expect(checkPlaces([newYork, midtown], heads)).toEqual([
      `${CITY}: image-size: midtown-manhattan-skyline-new-york.jpg: its source_url answered HTTP 404; it needs to load`,
    ]);
  });

  it('holds its SEO title and description to the post limits', () => {
    const city = editedPlace(newYork, [
      [
        'title: Where to meet in New York\n',
        'title: Where to meet in New York City with friends, family and coworkers\n',
      ],
    ]);
    const town = editedPlace(midtown, [
      [
        "description: 'Sample page: places in Midtown Manhattan for team meetings and welcome lunches, a short walk from Grand Central and Bryant Park.'",
        'description: Places in Midtown for team lunches.',
      ],
    ]);
    expect(checkPlaces([city, town])).toEqual([
      `${CITY}: title: the title is 78 characters with its " | Where2Meet" suffix; it needs at most 60`,
      `${TOWN}: description: the description is 35 characters; it needs 120 to 155`,
    ]);
  });

  it('blocks off-brand wording and style marks in its copy', () => {
    const city = editedPlace(newYork, [['the most convenient pick', 'the fairest pick']]);
    const town = editedPlace(midtown, [
      ["caption: Bryant Park's lawn in Midtown", 'caption: Bryant Park\u2019s lawn in Midtown'],
    ]);
    expect(checkPlaces([city, town])).toEqual([
      `${CITY}: wording: the Getting around section says "fairest"; write "convenient", and never a word starting with "fair" or "meet in the middle"`,
      `${TOWN}: style: the caption of bryant-park-lawn-midtown.jpg has a curly quote; use straight quotes instead of "\u2019"`,
    ]);
  });
});
