import { describe, expect, it } from 'vitest';
import { layoutBody, type BodyBlock } from '../body';
import type { CommonsImage } from '../photos';

function photo(fileName: string): CommonsImage {
  return {
    fileName,
    sourceUrl: `https://upload.wikimedia.org/wikipedia/commons/a/ab/${fileName}`,
    src: `/blog/images/${fileName}`,
    width: 1280,
    height: 960,
    alt: fileName,
    caption: '',
    credit: {
      author: 'Phi',
      license: 'CC0',
      pageUrl: 'https://commons.wikimedia.org/wiki/File:x',
      cropped: false,
    },
  };
}

const [cover, lawn, station, pier] = ['cover.jpg', 'lawn.jpg', 'station.jpg', 'pier.jpg'].map(
  photo
);

function outline(blocks: BodyBlock[]) {
  return blocks.map((block) => {
    if (block.kind === 'photo') return `photo ${block.image.fileName}`;
    if (block.kind === 'places') return 'places';
    if (block.kind === 'plan') return 'plan';
    return block.source;
  });
}

const sections = [
  'Answer first.',
  '',
  '## One',
  '',
  'First.',
  '',
  '## Two',
  '',
  'Second.',
  '',
  '## Three',
  '',
  'Third.',
];

describe('layoutBody', () => {
  it('places each photo and the place cards where their lines are, and the call to plan before the next section', () => {
    const markdown = [
      'Answer first.',
      '',
      '![](lawn.jpg)',
      '',
      '## One',
      '',
      '  :::places  ',
      '',
      'Where the cards come from.',
      '',
      '![Ignored alt](station.jpg)',
      'Last.',
      '',
      '## Two',
      '',
      'Second.',
    ].join('\n');
    expect(outline(layoutBody(markdown, [cover, lawn, station], true))).toEqual([
      'Answer first.',
      'photo lawn.jpg',
      '## One',
      'places',
      'Where the cards come from.',
      'photo station.jpg',
      'Last.',
      'plan',
      '## Two\n\nSecond.',
    ]);
  });

  it('puts unplaced photos, place cards and the call to plan after the second section, never the cover', () => {
    expect(outline(layoutBody(sections.join('\n'), [cover, lawn, station], true))).toEqual([
      'Answer first.\n\n## One\n\nFirst.\n\n## Two\n\nSecond.',
      'photo lawn.jpg',
      'photo station.jpg',
      'places',
      'plan',
      '## Three\n\nThird.',
    ]);
  });

  it('puts them at the end of a body with fewer than three sections', () => {
    expect(outline(layoutBody('Answer first.\n\n## One\n\nFirst.', [cover, lawn], true))).toEqual([
      'Answer first.\n\n## One\n\nFirst.',
      'photo lawn.jpg',
      'places',
      'plan',
    ]);
  });

  it('shows the cover again only where a line places it, and skips unknown files and missing places', () => {
    const markdown = ['![](cover.jpg)', '![](unknown.jpg)', ':::places', ...sections].join('\n');
    expect(outline(layoutBody(markdown, [cover, pier], false))).toEqual([
      'photo cover.jpg',
      'Answer first.',
      'plan',
      '## One\n\nFirst.\n\n## Two\n\nSecond.',
      'photo pier.jpg',
      '## Three\n\nThird.',
    ]);
  });
});
