/**
 * Participant color assignment utility.
 *
 * Provides a predefined palette and logic for assigning
 * unique colors to participants in an event.
 * @module utils/colors
 */

/**
 * Predefined color palette for participants.
 *
 * 16 visually distinct colors optimized for map markers.
 * Order matters - earlier colors are assigned first.
 */
export const PARTICIPANT_COLORS = [
  "coral",
  "teal",
  "gold",
  "orchid",
  "lime",
  "dodgerblue",
  "tomato",
  "mediumseagreen",
  "slateblue",
  "darkorange",
  "hotpink",
  "steelblue",
  "yellowgreen",
  "mediumpurple",
  "indianred",
  "cadetblue",
] as const;

export type ParticipantColor = (typeof PARTICIPANT_COLORS)[number];

/**
 * Assigns a color to a new participant.
 *
 * Picks the first unused color from the palette.
 * If all colors are used, cycles through the palette again.
 * @param usedColors - Colors already assigned to other participants
 * @returns The assigned color
 * @example
 * ```typescript
 * const usedColors = ["coral", "teal"];
 * const newColor = assignColor(usedColors);
 * // Returns "gold" (first unused)
 * ```
 */
export function assignColor(usedColors: string[]): string {
  const usedSet = new Set(usedColors);

  // Find first unused color
  for (const color of PARTICIPANT_COLORS) {
    if (!usedSet.has(color)) {
      return color;
    }
  }

  // All colors used - cycle based on count
  const index = usedColors.length % PARTICIPANT_COLORS.length;
  // Index is always valid since we use modulo, but TypeScript needs assurance
  const color = PARTICIPANT_COLORS[index];
  return color ?? PARTICIPANT_COLORS[0];
}

/**
 * Gets the next color in the palette based on participant count.
 *
 * Simple assignment based on order - useful when you just need
 * the nth color without tracking used colors.
 * @param participantCount - Number of existing participants
 * @returns The color for the new participant
 */
export function getColorByIndex(participantCount: number): string {
  const index = participantCount % PARTICIPANT_COLORS.length;
  const color = PARTICIPANT_COLORS[index];
  return color ?? PARTICIPANT_COLORS[0];
}
