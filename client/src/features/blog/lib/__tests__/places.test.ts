import { describe, expect, it } from 'vitest';
import {
  dataProviders,
  describeResults,
  formatRating,
  pickPlaces,
  shortAddress,
  type PlaceSummary,
} from '../places';

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

describe('pickPlaces', () => {
  it('alternates between queries and skips places both queries found', () => {
    const coworking = [place('hub'), place('desk'), place('loft')];
    const cafes = [place('bean'), place('hub'), place('brew')];

    expect(pickPlaces([coworking, cafes], 6).map(({ id }) => id)).toEqual([
      'hub',
      'bean',
      'desk',
      'loft',
      'brew',
    ]);
  });

  it('puts places with a photo first and stops at the limit', () => {
    const results = [place('a', false), place('b'), place('c', false), place('d'), place('e')];

    expect(pickPlaces([results], 4).map(({ id }) => id)).toEqual(['b', 'd', 'e', 'a']);
  });
});

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

describe('describeResults', () => {
  it.each([
    [6, 'Showing 6 places near Chicago.'],
    [1, 'Showing 1 place near Chicago.'],
    [0, 'No places came up near Chicago.'],
  ])('describes %i results', (count, expected) => {
    expect(describeResults(count, 'Chicago')).toBe(expected);
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
