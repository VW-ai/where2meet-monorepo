import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { themeItemList } from '../lib/json-ld';
import { parseTheme, type LiveTheme } from '../model/themes';

function ducks(): LiveTheme {
  const file = path.join(process.cwd(), 'src/content/nyc-themes/ducks.yaml');
  const result = parseTheme(parseYaml(readFileSync(file, 'utf8')));
  if (!result.ok || result.theme.status !== 'live') throw new Error('ducks.yaml should parse');
  return result.theme;
}

describe('themeItemList', () => {
  it('lists every place in order with its note and Google Maps link', () => {
    const theme = ducks();
    const list = themeItemList(theme) as unknown as {
      name: string;
      url: string;
      numberOfItems: number;
      itemListElement: {
        position: number;
        item: { name: string; description: string; hasMap: string };
      }[];
    };
    expect(list.name).toBe(theme.title);
    expect(list.url).toMatch(/\/nyc\/ducks$/);
    expect(list.numberOfItems).toBe(theme.places.length);
    expect(list.itemListElement.map((entry) => entry.position)).toEqual(
      theme.places.map((_, index) => index + 1)
    );
    const first = list.itemListElement[0].item;
    expect(first.name).toBe(theme.places[0].label);
    expect(first.description).toBe(theme.places[0].note);
    expect(first.hasMap).toContain(`query_place_id=${theme.places[0].placeId}`);
  });

  it('gives an empty theme an empty list', () => {
    const list = themeItemList({ ...ducks(), places: [] }) as unknown as {
      numberOfItems: number;
      itemListElement: unknown[];
    };
    expect(list.numberOfItems).toBe(0);
    expect(list.itemListElement).toEqual([]);
  });
});
