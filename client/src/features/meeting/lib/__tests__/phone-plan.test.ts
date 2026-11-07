import { describe, expect, it } from 'vitest';
import {
  fitSearchArea,
  fittedWordSize,
  initials,
  offsetPoint,
  pickerDays,
  planKind,
} from '../phone-plan';

const SIZES = [84, 62, 38, 26];
const halfEm = (text: string, size: number) => text.length * size * 0.5;

describe('planKind', () => {
  it.each([
    ['Coffee with Sam', 'coffee'],
    ['Team dinner', 'food'],
    ['Birthday drinks', 'drinks'],
    ['Saturday', 'meetup'],
  ])('reads %s as %s', (title, kind) => {
    expect(planKind(title)).toBe(kind);
  });
});

describe('fittedWordSize', () => {
  it('takes the largest size that fits on one line', () => {
    expect(fittedWordSize('HI', SIZES, { width: 350, height: 200 }, halfEm)).toBe(84);
  });

  it('shrinks until the words fit in two lines', () => {
    const size = fittedWordSize('COFFEE WITH SAM', SIZES, { width: 350, height: 200 }, halfEm);
    expect(size).toBe(62);
  });

  it('shrinks for a short box', () => {
    const size = fittedWordSize('COFFEE WITH SAM', SIZES, { width: 350, height: 90 }, halfEm);
    expect(size).toBe(38);
  });

  it('falls back to the smallest size when nothing fits', () => {
    expect(fittedWordSize('A'.repeat(200), SIZES, { width: 100, height: 40 }, halfEm)).toBe(26);
  });
});

describe('fitSearchArea', () => {
  it('has no area without points', () => {
    expect(fitSearchArea([])).toBeNull();
  });

  it('centers between the points', () => {
    const area = fitSearchArea([
      { lat: 40, lng: -74 },
      { lat: 41, lng: -73 },
    ]);
    expect(area?.center).toEqual({ lat: 40.5, lng: -73.5 });
  });
});

describe('offsetPoint', () => {
  it('stays put with no offset', () => {
    const point = offsetPoint({ lat: 40.7, lng: -74 }, 14, 0, 0);
    expect(point.lat).toBeCloseTo(40.7, 6);
    expect(point.lng).toBeCloseTo(-74, 6);
  });

  it('moves south for a point lower on screen', () => {
    expect(offsetPoint({ lat: 40.7, lng: -74 }, 14, 0, 100).lat).toBeLessThan(40.7);
  });
});

describe('pickerDays', () => {
  it('offers fourteen days from today', () => {
    const now = new Date(2026, 10, 7, 12);
    const days = pickerDays(now);
    expect(days).toHaveLength(14);
    expect(days[0].getDate()).toBe(7);
    expect(days[13].getDate()).toBe(20);
  });
});

describe('initials', () => {
  it('takes the first two letters of a name', () => {
    expect(initials('Jamie')).toBe('Ja');
  });
});
