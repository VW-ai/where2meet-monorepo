import type { Locale } from '@/shared/lib/i18n';

/**
 * Name Generator Utility
 * Generates random participant names in format: {adjective}_{animal}
 */

const ADJECTIVES = [
  'happy',
  'sleepy',
  'fluffy',
  'bouncy',
  'clever',
  'gentle',
  'brave',
  'calm',
  'cheerful',
  'curious',
  'dreamy',
  'eager',
  'friendly',
  'graceful',
  'jolly',
  'kind',
  'lively',
  'merry',
  'peaceful',
  'playful',
  'quiet',
  'swift',
  'wise',
  'zany',
] as const;

const ANIMALS = [
  'cat',
  'dog',
  'fox',
  'bear',
  'rabbit',
  'deer',
  'owl',
  'panda',
  'koala',
  'tiger',
  'lion',
  'elephant',
  'penguin',
  'dolphin',
  'otter',
  'raccoon',
  'squirrel',
  'hedgehog',
  'turtle',
  'seal',
  'whale',
  'monkey',
  'hamster',
  'giraffe',
] as const;

/**
 * Generates a random name in format: {adjective}_{animal}
 * @returns A random name string (e.g., "happy_cat", "sleepy_fox")
 */
export function generateRandomName(locale: Locale = 'en'): string {
  if (locale === 'zh') return `${pick(ADJECTIVES_ZH)}${pick(ANIMALS_ZH)}`;
  return `${pick(ADJECTIVES)}_${pick(ANIMALS)}`;
}

const ADJECTIVES_ZH = [
  '开心的',
  '困困的',
  '毛茸茸的',
  '机灵的',
  '温柔的',
  '勇敢的',
  '淡定的',
  '好奇的',
];
const ANIMALS_ZH = ['熊猫', '小猫', '狐狸', '兔子', '企鹅', '柴犬', '松鼠', '考拉'];

function pick(words: readonly string[]): string {
  return words[Math.floor(Math.random() * words.length)];
}

/**
 * Generates multiple unique random names
 * @param count Number of unique names to generate
 * @returns Array of unique random names
 */
export function generateUniqueNames(count: number): string[] {
  const names = new Set<string>();
  let attempts = 0;
  const maxAttempts = count * 10; // Prevent infinite loop

  while (names.size < count && attempts < maxAttempts) {
    names.add(generateRandomName());
    attempts++;
  }

  return Array.from(names);
}

/**
 * Get all possible name combinations count
 * @returns Total possible unique names
 */
export function getTotalPossibleNames(): number {
  return ADJECTIVES.length * ANIMALS.length;
}
