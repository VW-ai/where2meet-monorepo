import { describe, expect, it } from 'vitest';
import { planHref, readPlanSeed } from '../plan-seed';

const now = new Date('2026-11-27T12:00:00Z');
const placeId = 'ChIJ2X25uw9644kRGG8gByNprGU';

function read(href: string) {
  return readPlanSeed(new URL(href, 'https://where2meet.test').searchParams, now);
}

describe('plan seed', () => {
  it('reads back the seed a link was built from', () => {
    const seed = {
      title: 'Study session & coffee',
      placeId,
      src: 'where-to-study-with-friends-new-york',
      time: '2026-12-01T18:30:00.000Z',
    };
    expect(read(planHref(seed))).toEqual(seed);
    expect(planHref({})).toBe('/');
  });

  it('cuts an over-long title to 100 characters', () => {
    expect(read(planHref({ title: 'x'.repeat(300) })).title).toHaveLength(100);
  });

  it('drops a malformed place id and keeps the rest', () => {
    expect(read('/?place=not-a-place-id&title=x')).toEqual({ title: 'x' });
  });

  it('drops a time that has passed', () => {
    expect(read(planHref({ title: 'x', time: '2026-11-26T12:00:00Z' }))).toEqual({ title: 'x' });
  });
});
