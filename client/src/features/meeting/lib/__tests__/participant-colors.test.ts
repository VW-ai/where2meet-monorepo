import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getHexColor,
  getMutedHexColor,
  personColor,
  PARTICIPANT_COLORS,
} from '../participant-colors';
import { useUiVersionStore } from '../../model/ui-version-store';

describe('getHexColor', () => {
  it('turns the names the server assigns into hex, because Google Maps rejects extended color names', () => {
    expect(getHexColor('coral')).toBe('#FF7F50');
    expect(getHexColor('orchid')).toBe('#DA70D6');
    expect(getHexColor('mediumseagreen')).toBe('#3CB371');
  });

  it('still reads the older class names', () => {
    expect(getHexColor('bg-red-500')).toBe('#EF4444');
  });

  it('falls back to mint for anything else', () => {
    expect(getHexColor('not-a-color')).toBe('#6BCB77');
    expect(getHexColor(undefined)).toBe('#6BCB77');
  });

  it('knows every color in the server palette', () => {
    const source = readFileSync(
      path.join(__dirname, '../../../../../../server/src/utils/colors.ts'),
      'utf8'
    );
    const palette = source.slice(
      source.indexOf('PARTICIPANT_COLORS'),
      source.indexOf('] as const')
    );
    const names = [...palette.matchAll(/"([a-z]+)"/g)].map(([, name]) => name);
    expect(names).toHaveLength(16);
    for (const name of names) expect(getHexColor(name), name).not.toBe('#6BCB77');
  });
});

describe('getMutedHexColor', () => {
  const SERVER_PALETTE = readFileSync(
    path.join(process.cwd(), '../server/src/utils/colors.ts'),
    'utf8'
  ).match(/"[a-z]+"/g)!;

  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((at) => {
      const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  it('keeps white initials readable on every color a person can have', () => {
    for (const color of [
      ...SERVER_PALETTE.map((name) => name.slice(1, -1)),
      ...PARTICIPANT_COLORS,
    ]) {
      const contrast = 1.05 / (luminance(getMutedHexColor(color)) + 0.05);
      expect(contrast, color).toBeGreaterThanOrEqual(3);
    }
  });

  it('is quieter than the color it replaces', () => {
    expect(luminance(getMutedHexColor('lime'))).toBeLessThan(luminance(getHexColor('lime')));
    expect(luminance(getMutedHexColor('gold'))).toBeLessThan(luminance(getHexColor('gold')));
  });
});

describe('personColor', () => {
  it('leaves classic with the colors it was recorded with', () => {
    useUiVersionStore.setState({ version: 'classic' });
    expect(personColor('lime')).toBe(getHexColor('lime'));
    useUiVersionStore.setState({ version: 'v2' });
    expect(personColor('lime')).toBe(getMutedHexColor('lime'));
  });
});
