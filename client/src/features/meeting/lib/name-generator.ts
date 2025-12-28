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
export function generateRandomName(): string {
  const randomAdjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const randomAnimal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${randomAdjective}_${randomAnimal}`;
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
