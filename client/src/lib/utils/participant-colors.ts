/**
 * Participant Color Utilities
 * Manages color assignment for participants
 */

// 10 distinct colors for participant avatars (from ParticipantComponent.ts reference)
export const PARTICIPANT_COLORS = [
  'bg-red-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-orange-500',
  'bg-teal-500',
  'bg-cyan-500',
] as const;

/**
 * Get a deterministic color based on participant ID
 * @param id Participant ID
 * @returns Tailwind color class
 */
export function getColorForId(id: string): string {
  const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length];
}

/**
 * Get a random color from the palette
 * @returns Tailwind color class
 */
export function getRandomColor(): string {
  return PARTICIPANT_COLORS[Math.floor(Math.random() * PARTICIPANT_COLORS.length)];
}

/**
 * Get initials from a name
 * @param name Full name
 * @returns Initials (up to 2 characters)
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
