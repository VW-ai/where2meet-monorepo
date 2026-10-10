import { parse as parseYaml } from 'yaml';

export type Fields = Record<string, unknown>;

export interface PostFile {
  name: string;
  text: string;
}

export type PostFileContent =
  | { ok: true; frontMatter: Fields; body: string }
  | { ok: false; problem: string };

export const POSTS_DIR = 'src/content/posts';

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export function postFilePath({ name }: PostFile): string {
  return `${POSTS_DIR}/${name}`;
}

export function postFileSlug({ name }: PostFile): string {
  return name.replace(/\.md$/, '');
}

export function readPostFile(text: string): PostFileContent {
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

/** The `file_name` of every image the front matter lists, before any image is checked. */
export function writtenFileNames(frontMatter: Fields): string[] {
  return listOf(frontMatter.images).flatMap((image) =>
    isFields(image) && typeof image.file_name === 'string' ? [image.file_name] : []
  );
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
