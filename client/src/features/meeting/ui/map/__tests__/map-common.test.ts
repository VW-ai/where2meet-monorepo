import { describe, expect, it } from 'vitest';
import { isInUncoveredMap, likedVenueMarkerTitle } from '../map-common';

describe('isInUncoveredMap', () => {
  const corner = (lat: number, lng: number) => ({ lat: () => lat, lng: () => lng });
  const bounds = {
    getNorthEast: () => corner(10, 10),
    getSouthWest: () => corner(0, 0),
  } as unknown as google.maps.LatLngBounds;
  const size = { clientWidth: 1000, clientHeight: 1000 };
  const padding = { top: 100, right: 0, bottom: 0, left: 400 };

  it('finds a pin beside the panels', () => {
    expect(isInUncoveredMap({ lat: 5, lng: 7 }, bounds, size, padding)).toBe(true);
  });

  it('treats a pin under a panel as out of view', () => {
    expect(isInUncoveredMap({ lat: 5, lng: 2 }, bounds, size, padding)).toBe(false);
  });

  it('treats a pin off the map as out of view', () => {
    expect(isInUncoveredMap({ lat: 5, lng: 11 }, bounds, size, padding)).toBe(false);
  });

  it('is unsure before the map has bounds', () => {
    expect(isInUncoveredMap({ lat: 5, lng: 7 }, undefined, size, padding)).toBe(false);
  });
});

describe('likedVenueMarkerTitle', () => {
  it('marks liked and published venues in English', () => {
    expect(likedVenueMarkerTitle('Blue Bottle', false)).toBe('Blue Bottle (Liked)');
    expect(likedVenueMarkerTitle('Blue Bottle', true)).toBe('Blue Bottle (Published)');
  });

  it('marks liked and published venues in Chinese', () => {
    expect(likedVenueMarkerTitle('三里屯太古里', false, 'zh')).toBe('三里屯太古里（已喜欢）');
    expect(likedVenueMarkerTitle('三里屯太古里', true, 'zh')).toBe('三里屯太古里（已发布）');
  });
});
