import { describe, it, expect } from 'vitest';
import { venueSearchFilters } from '../venue-search-filters';

describe('venueSearchFilters', () => {
  it('sends text queries unchanged for Google events', () => {
    expect(venueSearchFilters('google', 'Cafe')).toEqual({ query: 'Cafe' });
  });

  it('turns category chips into AMap categories', () => {
    expect(venueSearchFilters('amap', 'Cafe')).toEqual({ categories: ['cafe'] });
    expect(venueSearchFilters('amap', 'places to meet')).toEqual({
      categories: ['cafe', 'restaurant'],
    });
    expect(venueSearchFilters('amap', 'Things to do')).toEqual({ categories: ['things_to_do'] });
  });

  it('keeps free text as an AMap keyword search', () => {
    expect(venueSearchFilters('amap', '火锅')).toEqual({ query: '火锅' });
  });
});
