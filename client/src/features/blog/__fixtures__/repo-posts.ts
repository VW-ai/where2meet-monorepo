import { readFileSync } from 'node:fs';
import type * as FsPromises from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'yaml';
import { TAXONOMY_FILE } from '../lib/parse';
import { POSTS_DIR, type PostFile } from '../lib/post-file';

export const REPO_TAXONOMY = readFileSync(path.join(process.cwd(), TAXONOMY_FILE), 'utf8');

function commonsImage(fileName: string, commonsFile: string, fields: Record<string, unknown> = {}) {
  return {
    file_name: fileName,
    source_url: `https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/${commonsFile}/1280px-${commonsFile}`,
    page_url: `https://commons.wikimedia.org/wiki/File:${commonsFile}`,
    width: 1280,
    height: 853,
    alt: commonsFile.replace(/_/g, ' ').replace(/\.jpg$/, ''),
    caption: 'A place the post names',
    author: 'Phi',
    license: 'CC0',
    cropped: false,
    ...fields,
  };
}

export function markdownPostFile(slug: string, frontMatter: Record<string, unknown>, body: string) {
  return { name: `${slug}.md`, text: `---\n${stringify(frontMatter)}---\n${body}` };
}

export const REPO_POST_FILES: readonly PostFile[] = [
  markdownPostFile(
    'how-to-plan-a-coffee-catch-up',
    {
      title: 'How to plan a coffee catch-up',
      description: 'Pick a coffee shop you can both reach.',
      main_keyword: 'coffee catch-up',
      occasion: 'coffee-catch-up',
      time: null,
      venue_type: 'coffee-shop',
      group_size: 'two',
      budget: null,
      city: null,
      town: null,
      published_at: '2026-10-09',
      updated_at: '2026-10-10',
      places: [{ place_id: 'ChIJcoffee1', label: 'Think Coffee', note: 'Near Union Square' }],
      images: [
        commonsImage('union-square-park-lawn.jpg', 'Union_Square_Park_lawn.jpg'),
        commonsImage('union-square-farmers-market.jpg', 'Union_Square_Greenmarket.jpg', {
          license: 'CC BY 4.0',
          author: 'Ann',
        }),
      ],
    },
    'A coffee catch-up works best near a station you both use.\n\n## Where should we meet?\n\nPick a station.\n\n![](union-square-farmers-market.jpg)\n\n:::places\n'
  ),
  markdownPostFile(
    'after-work-drinks-near-bryant-park',
    {
      title: 'After-work drinks near Bryant Park',
      description: 'Where a team can meet after work in Midtown.',
      main_keyword: 'after-work drinks',
      occasion: 'team-welcome',
      time: 'after-work',
      venue_type: null,
      group_size: 'large',
      budget: null,
      city: 'new-york',
      town: 'midtown',
      published_at: '2026-10-07',
      updated_at: '2026-10-07',
      places: [],
      images: [commonsImage('bryant-park-terrace-evening.jpg', 'Bryant_Park_terrace.jpg')],
    },
    'Meet near Bryant Park after work.\n'
  ),
];

export function withPostFiles(
  fs: typeof FsPromises,
  files: () => readonly PostFile[]
): typeof FsPromises {
  const dir = path.join(process.cwd(), POSTS_DIR);
  const readdir = (async (target: string, ...rest: []) => {
    const names = await fs.readdir(target, ...rest);
    return target === dir ? [...names, ...files().map(({ name }) => name)] : names;
  }) as typeof fs.readdir;
  const readFile = (async (target: string, ...rest: [BufferEncoding]) => {
    const file = files().find(({ name }) => target === path.join(dir, name));
    return file ? file.text : fs.readFile(target, ...rest);
  }) as typeof fs.readFile;
  return { ...fs, readdir, readFile };
}
