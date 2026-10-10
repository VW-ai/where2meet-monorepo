import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkPosts, formatProblem, type ImageHead } from '../post-checks';
import { REPO_TAXONOMY } from '../../__fixtures__/repo-posts';
import { postFilePath, type PostFile } from '../post-file';

const NAME = 'group-dinner-after-work.md';
const example: PostFile = {
  name: NAME,
  text: readFileSync(path.join(__dirname, '../../__fixtures__/posts', NAME), 'utf8'),
};
const FILE = postFilePath(example);

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

function check(
  files: readonly PostFile[],
  heads: ReadonlyMap<string, ImageHead> = new Map()
): string[] {
  return checkPosts(files, {
    mdxSlugs: ['how-to-pick-a-date-spot'],
    heads,
    taxonomyText: REPO_TAXONOMY,
  }).map(formatProblem);
}

function edited(edits: readonly [from: string, to: string][], name = NAME): PostFile {
  let text = example.text;
  for (const [from, to] of edits) {
    if (!text.includes(from)) throw new Error(`the example has no ${JSON.stringify(from)}`);
    text = text.replaceAll(from, to);
  }
  return { name, text };
}

describe('checkPosts', () => {
  it('passes the example, and fails it only on the slug under a taken name', () => {
    const heads = new Map<string, ImageHead>([
      [COVER_URL, { status: 200, bytes: 486_621, contentType: 'image/jpeg' }],
      [FULTON_URL, { status: 200, bytes: 389_396, contentType: 'image/jpeg' }],
      [ATLANTIC_URL, { status: 200, bytes: 301_205, contentType: 'image/jpeg' }],
    ]);
    expect(check([example], heads)).toEqual([]);
    expect(check([{ ...example, name: 'how-to-pick-a-date-spot.md' }], heads)).toEqual([
      'src/content/posts/how-to-pick-a-date-spot.md: slug: the slug "how-to-pick-a-date-spot" is taken by an MDX post; a post needs a slug no other post has',
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
        `${FILE}: fields: front matter: invalid published_at`,
      ]);
    });

    it('reports a parameter key the taxonomy does not have', () => {
      expect(check([edited([['venue_type: null', 'venue_type: sushi-bar']])])).toEqual([
        `${FILE}: fields: front matter: unknown venue_type "sushi-bar"`,
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
        `${FILE}: fields: front matter.images[1]: license "CC BY-SA 4.0" is not allowed`,
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
        `${FILE}: fields: front matter.images[0]: unknown field "license_url"; an image has only file_name, source_url, page_url, width, height, alt, caption, author, license and cropped`,
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
        `${FILE}: fields: front matter.images[0]: cropped is "no"; it must be true or false`,
      ]);
    });

    it('needs a main keyword', () => {
      expect(
        check([edited([['main_keyword: group dinner after work', 'main_keyword: ""']])])
      ).toEqual([`${FILE}: fields: front matter: main_keyword is ""; it must be non-empty text`]);
    });
  });

  describe('slug', () => {
    it('keeps the photo route free', () => {
      expect(check([{ ...example, name: 'images.md' }])).toEqual([
        `src/content/posts/images.md: slug: the slug "images" is the site's photo route, /blog/images; a post needs another slug`,
      ]);
    });

    it('is the only check besides fields on a file the site drops', () => {
      const file = edited(
        [
          ['published_at: 2026-10-10', 'published_at: 10/10/2026'],
          ['## Common questions', '## Questions people ask'],
        ],
        'images.md'
      );
      expect(check([file])).toEqual([
        'src/content/posts/images.md: fields: front matter: invalid published_at',
        `src/content/posts/images.md: slug: the slug "images" is the site's photo route, /blog/images; a post needs another slug`,
      ]);
    });
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

    it('keeps each file name to one post', () => {
      const other = edited(
        [
          ['fulton-center-lower-manhattan.jpg', 'fulton-center-station.jpg'],
          ['atlantic-avenue-barclays-center-station-entrance.jpg', 'barclays-center-entrance.jpg'],
        ],
        'group-dinner-in-brooklyn.md'
      );
      expect(check([example, other])).toEqual([
        `${FILE}: images: file_name "west-32nd-street-koreatown-manhattan.jpg" is also used by src/content/posts/group-dinner-in-brooklyn.md; every photo needs a file name of its own`,
        `src/content/posts/group-dinner-in-brooklyn.md: images: file_name "west-32nd-street-koreatown-manhattan.jpg" is also used by ${FILE}; every photo needs a file name of its own`,
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
