import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { readPlanSeed } from '@/features/landing/model/plan-seed';
import { ICON_NAMES, parseTheme, type LiveTheme } from '../model/themes';
import { ICON_VIEWBOX } from '../ui/icons';

const DIR = path.join(process.cwd(), 'src/content/nyc-themes');
const files = readdirSync(DIR).filter((name) => name.endsWith('.yaml'));
const raw = (name: string) => parseYaml(readFileSync(path.join(DIR, name), 'utf8'));

describe('theme files', () => {
  it('include the three map themes and the two Coming soon tiles', () => {
    expect(files.sort()).toEqual([
      'ducks.yaml',
      'free-food.yaml',
      'hackathons.yaml',
      'indoors.yaml',
      'study-spots.yaml',
    ]);
  });

  it.each(files)('%s passes the schema, and its slug matches the file name', (name) => {
    const result = parseTheme(raw(name));
    expect(result.ok ? [] : result.problems).toEqual([]);
    if (result.ok) expect(`${result.theme.slug}.yaml`).toBe(name);
  });

  it.each(files)('%s names icons that exist', (name) => {
    const { marker, art } = raw(name);
    expect(ICON_VIEWBOX).toHaveProperty(marker);
    expect(ICON_VIEWBOX).toHaveProperty(art);
  });

  const live = files
    .map((name) => parseTheme(raw(name)))
    .flatMap((result) => (result.ok && result.theme.status === 'live' ? [result.theme] : []));

  it.each(live.map((theme) => [theme.slug, theme] as const))(
    '%s has 10 to 15 places, each once, with IDs the plan link keeps',
    (_, theme: LiveTheme) => {
      expect(theme.places.length).toBeGreaterThanOrEqual(10);
      expect(theme.places.length).toBeLessThanOrEqual(15);
      const ids = theme.places.map((place) => place.placeId);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) {
        expect(readPlanSeed(new URLSearchParams({ place: id })).placeId).toBe(id);
      }
    }
  );
});

describe('parseTheme', () => {
  const ducks = () => raw('ducks.yaml');

  it('rejects a place listed twice', () => {
    const theme = ducks();
    theme.places.push({ ...theme.places[0] });
    const result = parseTheme(theme);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.problems.join()).toMatch(/appears twice/);
  });

  it('rejects a place ID the plan link would drop', () => {
    const theme = ducks();
    theme.places[0].place_id = 'not a place';
    expect(parseTheme(theme).ok).toBe(false);
  });

  it('rejects an icon that does not exist', () => {
    expect(parseTheme({ ...ducks(), marker: 'unicorn' }).ok).toBe(false);
    expect(ICON_NAMES).not.toContain('unicorn');
  });

  it('accepts a Coming soon tile with no map fields', () => {
    const result = parseTheme(raw('hackathons.yaml'));
    expect(result.ok && result.theme.status).toBe('soon');
  });
});
