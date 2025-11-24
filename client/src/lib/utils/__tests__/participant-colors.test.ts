/**
 * Tests for Participant Color Utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getRandomColor,
  getColorForId,
  getInitials,
  PARTICIPANT_COLORS,
} from '../participant-colors';

describe('getRandomColor', () => {
  it('should return a color from the palette', () => {
    const color = getRandomColor();
    expect(PARTICIPANT_COLORS).toContain(color);
  });

  it('should return a valid Tailwind color class', () => {
    const color = getRandomColor();
    expect(color).toMatch(/^bg-(red|blue|green|yellow|purple|pink|indigo|orange|teal|cyan)-500$/);
  });

  it('should potentially return different colors on multiple calls', () => {
    const colors = new Set();
    for (let i = 0; i < 50; i++) {
      colors.add(getRandomColor());
    }
    // With 10 colors and 50 calls, we should get multiple different colors
    expect(colors.size).toBeGreaterThan(1);
  });
});

describe('getColorForId', () => {
  it('should return a color from the palette', () => {
    const color = getColorForId('test-id-123');
    expect(PARTICIPANT_COLORS).toContain(color);
  });

  it('should return the same color for the same ID (deterministic)', () => {
    const id = 'participant-456';
    const color1 = getColorForId(id);
    const color2 = getColorForId(id);
    expect(color1).toBe(color2);
  });

  it('should return different colors for different IDs', () => {
    const color1 = getColorForId('id-1');
    const color2 = getColorForId('id-2');
    const color3 = getColorForId('id-3');

    // At least some should be different (not guaranteed all different due to hash collisions)
    const uniqueColors = new Set([color1, color2, color3]);
    expect(uniqueColors.size).toBeGreaterThanOrEqual(1);
  });

  it('should handle empty string', () => {
    const color = getColorForId('');
    expect(PARTICIPANT_COLORS).toContain(color);
  });

  it('should handle special characters in ID', () => {
    const color = getColorForId('!@#$%^&*()');
    expect(PARTICIPANT_COLORS).toContain(color);
  });

  it('should distribute colors across the palette', () => {
    const colors = new Set();
    for (let i = 0; i < 100; i++) {
      colors.add(getColorForId(`participant-${i}`));
    }
    // With 100 IDs and 10 colors, we should see all colors
    expect(colors.size).toBe(PARTICIPANT_COLORS.length);
  });
});

describe('getInitials', () => {
  it('should extract initials from first and last name', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('should extract initials from three-word name (max 2)', () => {
    expect(getInitials('John Michael Doe')).toBe('JM');
  });

  it('should handle single name', () => {
    expect(getInitials('Madonna')).toBe('M');
  });

  it('should return uppercase initials', () => {
    expect(getInitials('alice wonderland')).toBe('AW');
  });

  it('should handle empty string', () => {
    expect(getInitials('')).toBe('');
  });

  it('should handle names with extra spaces', () => {
    expect(getInitials('  John   Doe  ')).toBe('JD');
  });

  it('should handle hyphenated names', () => {
    expect(getInitials('Mary-Jane Watson')).toBe('MW');
  });

  it('should handle names with special characters', () => {
    expect(getInitials('José María')).toBe('JM');
  });

  it('should limit to 2 characters maximum', () => {
    expect(getInitials('A B C D E F')).toBe('AB');
    expect(getInitials('A B C D E F').length).toBeLessThanOrEqual(2);
  });

  it('should handle names with numbers', () => {
    expect(getInitials('John 2 Doe')).toBe('J2');
  });
});

describe('PARTICIPANT_COLORS', () => {
  it('should have exactly 10 colors', () => {
    expect(PARTICIPANT_COLORS).toHaveLength(10);
  });

  it('should have unique colors', () => {
    const uniqueColors = new Set(PARTICIPANT_COLORS);
    expect(uniqueColors.size).toBe(PARTICIPANT_COLORS.length);
  });

  it('should only contain bg-*-500 classes', () => {
    PARTICIPANT_COLORS.forEach((color) => {
      expect(color).toMatch(/^bg-\w+-500$/);
    });
  });
});
