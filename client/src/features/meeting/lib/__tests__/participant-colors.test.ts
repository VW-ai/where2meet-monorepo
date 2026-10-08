import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getHexColor } from '../participant-colors';

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
