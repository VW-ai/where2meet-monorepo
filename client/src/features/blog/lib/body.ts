import type { CommonsImage } from './photos';

export type BodyBlock =
  | { kind: 'markdown'; source: string }
  | { kind: 'photo'; image: CommonsImage }
  | { kind: 'places' };

/** `![](bryant-park-lawn-midtown.jpg)` on a line of its own. */
const PHOTO_LINE = /^!\[[^\]]*\]\(([a-z0-9-]+\.jpg)\)$/;
const PLACES_LINE = ':::places';
const SECTION_HEADING = /^## /;

/**
 * Splits a panel post's Markdown at its photo and place-card lines. A photo line places
 * the image with that file name. The cover, `images[0]`, already shows above the body,
 * so it appears in the body only where a line places it. Every other image the body
 * doesn't place, and the place cards when no line places them, go after the second
 * `##` section.
 */
export function layoutBody(
  markdown: string,
  images: readonly CommonsImage[],
  hasPlaces: boolean
): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  const placed = new Set<CommonsImage>();
  let placesPlaced = false;
  let sections = 0;
  let afterSecondSection: number | null = null;
  let lines: string[] = [];

  const flush = () => {
    const source = lines.join('\n').trim();
    if (source) blocks.push({ kind: 'markdown', source });
    lines = [];
  };

  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();
    const photo = PHOTO_LINE.exec(trimmed);
    if (photo) {
      flush();
      const image = images.find(({ fileName }) => fileName === photo[1]);
      if (image) {
        blocks.push({ kind: 'photo', image });
        placed.add(image);
      }
    } else if (trimmed === PLACES_LINE) {
      flush();
      if (hasPlaces && !placesPlaced) blocks.push({ kind: 'places' });
      placesPlaced = true;
    } else {
      if (SECTION_HEADING.test(line) && ++sections === 3) {
        flush();
        afterSecondSection = blocks.length;
      }
      lines.push(line);
    }
  }
  flush();

  const rest: BodyBlock[] = [
    ...images
      .slice(1)
      .filter((image) => !placed.has(image))
      .map((image): BodyBlock => ({ kind: 'photo', image })),
    ...(hasPlaces && !placesPlaced ? [{ kind: 'places' } as const] : []),
  ];
  blocks.splice(afterSecondSection ?? blocks.length, 0, ...rest);
  return blocks;
}
