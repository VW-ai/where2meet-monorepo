import { parse as parseYaml } from 'yaml';

export type Fields = Record<string, unknown>;

/** A file the site reads from the repo, named relative to the folder it was listed in. */
export interface ContentFile {
  name: string;
  text: string;
}

export type FrontMatterContent =
  | { ok: true; frontMatter: Fields; body: string }
  | { ok: false; problem: string };

/** Relative to the client root, where the site and CI read them. */
export const CONTENT_DIR = 'src/content';
export const POSTS_DIR = `${CONTENT_DIR}/posts`;
export const PLACES_DIR = `${CONTENT_DIR}/places`;
export const TAXONOMY_FILE = `${CONTENT_DIR}/taxonomy.yaml`;
export const KEYWORDS_FILE = `${CONTENT_DIR}/keywords.yaml`;
export const WRITING_RULES_FILE = 'docs/writing-rules.md';

/** Python's `\s`, which also counts \x1c to \x1f and \x85 and leaves out \ufeff. */
export const SPACE = String.raw`[\t-\r\x1c-\x20\x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]`;

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export function filePath(dir: string, name: string): string {
  return `${dir}/${name}`;
}

/** `new-york/midtown.md` is `['new-york', 'midtown']`. */
export function fileSegments(name: string): string[] {
  return name.replace(/\.md$/, '').split('/');
}

export function readFrontMatter(text: string): FrontMatterContent {
  const match = FRONT_MATTER.exec(text);
  if (!match) return { ok: false, problem: 'no front matter between two --- lines at the top' };
  const yaml = readYaml(match[1]);
  if (!yaml.ok) return { ok: false, problem: `front matter is not valid YAML: ${yaml.problem}` };
  if (!isFields(yaml.value)) {
    return { ok: false, problem: 'front matter is not a YAML mapping of fields' };
  }
  return { ok: true, frontMatter: yaml.value, body: text.slice(match[0].length) };
}

/** YAML 1.2, so `2026-10-10` stays a string and a repeated key is an error. */
export function readYaml(
  text: string
): { ok: true; value: unknown } | { ok: false; problem: string } {
  try {
    return { ok: true, value: parseYaml(text, { logLevel: 'error' }) };
  } catch (error) {
    return {
      ok: false,
      problem: error instanceof Error ? error.message.split('\n')[0] : String(error),
    };
  }
}

/** Python's `casefold`, closely enough for matching: upper then lower also folds ß to ss. */
export function normalize(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201a\u201b\u2032]/gu, "'")
    .replace(/[\u201c-\u201f\u2033]/gu, '"')
    .toUpperCase()
    .toLowerCase()
    .split(new RegExp(`${SPACE}+`, 'u'))
    .filter(Boolean)
    .join(' ');
}

export function isFields(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

export function listOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
