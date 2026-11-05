/**
 * Participant Color Utilities
 * Manages color assignment for participants
 */

import { useUiVersionStore } from '../model/ui-version-store';

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

// Hex color mapping for Google Maps markers
export const PARTICIPANT_HEX_COLORS: Record<string, string> = {
  'bg-red-500': '#EF4444',
  'bg-blue-500': '#3B82F6',
  'bg-green-500': '#22C55E',
  'bg-yellow-500': '#EAB308',
  'bg-purple-500': '#A855F7',
  'bg-pink-500': '#EC4899',
  'bg-indigo-500': '#6366F1',
  'bg-orange-500': '#F97316',
  'bg-teal-500': '#14B8A6',
  'bg-cyan-500': '#06B6D4',
};

/**
 * The palette the server assigns (server/src/utils/colors.ts) is CSS color names. Google Maps
 * rejects extended names like "coral", so markers and routes need them as hex.
 */
const SERVER_HEX_COLORS: Record<string, string> = {
  coral: '#FF7F50',
  teal: '#008080',
  gold: '#FFD700',
  orchid: '#DA70D6',
  lime: '#00FF00',
  dodgerblue: '#1E90FF',
  tomato: '#FF6347',
  mediumseagreen: '#3CB371',
  slateblue: '#6A5ACD',
  darkorange: '#FF8C00',
  hotpink: '#FF69B4',
  steelblue: '#4682B4',
  yellowgreen: '#9ACD32',
  mediumpurple: '#9370DB',
  indianred: '#CD5C5C',
  cadetblue: '#5F9EA0',
};

/**
 * The color the server will give the next person (assignColor in server/src/utils/colors.ts):
 * the first unused one in palette order, then cycling by count.
 */
export function nextParticipantColor(participants: ReadonlyArray<{ color: string }>): string {
  const palette = Object.keys(SERVER_HEX_COLORS);
  const used = new Set(participants.map((person) => person.color));
  return (
    palette.find((color) => !used.has(color)) ?? palette[participants.length % palette.length]
  );
}

/**
 * A participant's color as hex, from a server palette name or an older Tailwind class.
 */
export function getHexColor(color: string | undefined): string {
  return (color && (SERVER_HEX_COLORS[color] ?? PARTICIPANT_HEX_COLORS[color])) || '#6BCB77'; // fallback to mint
}

/**
 * The redesign's quieter take on each palette color. Keyed the same way, so a person keeps their
 * hue and stored color. White initials sit on all of them, so each stays dark enough to read.
 */
const MUTED_HEX_COLORS: Record<string, string> = {
  coral: '#C2704F',
  teal: '#3F7F7C',
  gold: '#A9853D',
  orchid: '#A06F9C',
  lime: '#6F8C4A',
  dodgerblue: '#4F80AB',
  tomato: '#BA5A50',
  mediumseagreen: '#528A6F',
  slateblue: '#6C68A0',
  darkorange: '#B97A3C',
  hotpink: '#B8678A',
  steelblue: '#547C98',
  yellowgreen: '#7F8C48',
  mediumpurple: '#8573AD',
  indianred: '#A85D5D',
  cadetblue: '#568488',
  'bg-red-500': '#BA5A50',
  'bg-blue-500': '#4F80AB',
  'bg-green-500': '#528A6F',
  'bg-yellow-500': '#A9853D',
  'bg-purple-500': '#8573AD',
  'bg-pink-500': '#B8678A',
  'bg-indigo-500': '#6C68A0',
  'bg-orange-500': '#B97A3C',
  'bg-teal-500': '#3F7F7C',
  'bg-cyan-500': '#568488',
};

/** A person's color in the redesign. */
export function getMutedHexColor(color: string | undefined): string {
  return (color && MUTED_HEX_COLORS[color]) || '#528A6F';
}

/** A person's color for surfaces both UI versions share. Classic stays as recorded. */
export function personColor(color: string | undefined): string {
  return useUiVersionStore.getState().version === 'v2'
    ? getMutedHexColor(color)
    : getHexColor(color);
}

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
