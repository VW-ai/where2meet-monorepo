import { describe, expect, it } from 'vitest';
import { likedVenueMarkerTitle } from '../map-common';

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
