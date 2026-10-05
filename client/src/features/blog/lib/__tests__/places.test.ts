import { describe, expect, it } from 'vitest';
import { dataProviders, formatRating, shortAddress, type PlaceSummary } from '../places';

function place(
  id: string,
  hasPhoto = true,
  providers: PlaceSummary['providers'] = []
): PlaceSummary {
  return {
    id,
    name: id,
    mapsUrl: `https://maps.google.com/?cid=${id}`,
    type: null,
    address: null,
    rating: null,
    photo: hasPhoto ? { url: `https://example.com/${id}.jpg`, credits: [] } : null,
    providers,
  };
}

describe('formatRating', () => {
  it('shows one decimal and a grouped review count', () => {
    expect(formatRating({ value: 4.6, count: 1203 })).toBe('4.6 (1,203)');
    expect(formatRating({ value: 4, count: 7 })).toBe('4.0 (7)');
  });
});

describe('shortAddress', () => {
  it.each([
    ['1 Ferry Building, San Francisco, CA 94111, USA', '1 Ferry Building, San Francisco'],
    ['Marktplatz 1, 80331 München, Germany', 'Marktplatz 1, 80331 München'],
    ['Lisbon, Portugal', 'Lisbon'],
    ['Somewhere', 'Somewhere'],
  ])('shortens %s', (formattedAddress, expected) => {
    expect(shortAddress(formattedAddress)).toBe(expected);
  });
});

describe('dataProviders', () => {
  it('lists each provider once, in order of first appearance', () => {
    const yelp = { name: 'Yelp', url: 'https://www.yelp.com/' };
    const local = { name: 'Local Guide Co', url: null };

    expect(
      dataProviders([place('a', true, [yelp]), place('b'), place('c', true, [local, yelp])])
    ).toEqual([
      { name: 'Yelp', url: 'https://www.yelp.com/' },
      { name: 'Local Guide Co', url: null },
    ]);
  });
});
