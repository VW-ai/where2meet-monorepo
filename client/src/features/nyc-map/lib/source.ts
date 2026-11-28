import 'server-only';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { cache } from 'react';
import { parse as parseYaml } from 'yaml';
import { parseTheme, type LiveTheme, type Theme } from '../model/themes';

export const THEMES_DIR = 'src/content/nyc-themes';

/**
 * Every theme file, in tile order. A file that fails its checks stops the build:
 * the files live in the repo, so a broken one is a bug to fix, not a page to skip.
 */
export const loadThemes = cache(async (): Promise<Theme[]> => {
  const root = path.join(process.cwd(), THEMES_DIR);
  const names = (await readdir(root)).filter((name) => name.endsWith('.yaml')).sort();
  const themes = await Promise.all(
    names.map(async (name) => {
      const result = parseTheme(parseYaml(await readFile(path.join(root, name), 'utf8')));
      if (!result.ok) throw new Error(`${THEMES_DIR}/${name}: ${result.problems.join('; ')}`);
      if (`${result.theme.slug}.yaml` !== name) {
        throw new Error(
          `${THEMES_DIR}/${name}: slug ${result.theme.slug} does not match the file name`
        );
      }
      return result.theme;
    })
  );
  return themes.sort((a, b) => a.order - b.order);
});

export async function loadLiveThemes(): Promise<LiveTheme[]> {
  return (await loadThemes()).filter((theme): theme is LiveTheme => theme.status === 'live');
}

export async function loadLiveTheme(slug: string): Promise<LiveTheme | null> {
  return (await loadLiveThemes()).find((theme) => theme.slug === slug) ?? null;
}
