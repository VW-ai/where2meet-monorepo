/**
 * Tests for Location Utilities
 */

import { describe, it, expect } from 'vitest';
import {
  applyFuzzyOffset,
  formatFuzzyAddress,
  calculateDistance,
  formatDistance,
} from '../location';
import type { Location } from '@/types';

describe('applyFuzzyOffset', () => {
  it('should apply offset to coordinates', () => {
    const original: Location = { lat: 40.7128, lng: -74.006 };
    const fuzzy = applyFuzzyOffset(original);

    // Should not be the same as original
    expect(fuzzy.lat).not.toBe(original.lat);
    expect(fuzzy.lng).not.toBe(original.lng);
  });

  it('should apply offset within bounds (0.005 to 0.01 degrees)', () => {
    const original: Location = { lat: 40.7128, lng: -74.006 };
    const minOffset = 0.005;
    const maxOffset = 0.01;

    // Run multiple times to test randomness
    for (let i = 0; i < 100; i++) {
      const fuzzy = applyFuzzyOffset(original);
      const latDiff = Math.abs(fuzzy.lat - original.lat);
      const lngDiff = Math.abs(fuzzy.lng - original.lng);

      expect(latDiff).toBeGreaterThanOrEqual(minOffset);
      expect(latDiff).toBeLessThanOrEqual(maxOffset);
      expect(lngDiff).toBeGreaterThanOrEqual(minOffset);
      expect(lngDiff).toBeLessThanOrEqual(maxOffset);
    }
  });

  it('should produce different results on multiple calls', () => {
    const original: Location = { lat: 40.7128, lng: -74.006 };
    const fuzzy1 = applyFuzzyOffset(original);
    const fuzzy2 = applyFuzzyOffset(original);

    // Very unlikely to be the same (but technically possible with random)
    const isSame = fuzzy1.lat === fuzzy2.lat && fuzzy1.lng === fuzzy2.lng;
    expect(isSame).toBe(false);
  });
});

describe('formatFuzzyAddress', () => {
  it('should format full address to fuzzy address', () => {
    const address = '350 5th Ave, New York, NY 10118';
    const result = formatFuzzyAddress(address);
    expect(result).toBe('Near 5th Ave, New York');
  });

  it('should handle address with leading number', () => {
    const address = '123 Main St, Brooklyn, NY 11201';
    const result = formatFuzzyAddress(address);
    expect(result).toBe('Near Main St, Brooklyn');
  });

  it('should handle address without comma', () => {
    const address = 'Central Park';
    const result = formatFuzzyAddress(address);
    expect(result).toBe('Near Central Park');
  });

  it('should handle address with one comma', () => {
    const address = 'Broadway, Manhattan';
    const result = formatFuzzyAddress(address);
    expect(result).toBe('Near Broadway, Manhattan');
  });

  it('should remove leading numbers from street', () => {
    const address = '1 World Trade Center, New York, NY';
    const result = formatFuzzyAddress(address);
    expect(result).toBe('Near World Trade Center, New York');
  });
});

describe('calculateDistance', () => {
  it('should calculate distance between two points', () => {
    const point1: Location = { lat: 40.7128, lng: -74.006 }; // NYC
    const point2: Location = { lat: 40.7589, lng: -73.9851 }; // Times Square

    const distance = calculateDistance(point1, point2);

    // Distance should be approximately 5.6 km (5600 meters)
    expect(distance).toBeGreaterThan(5000);
    expect(distance).toBeLessThan(6000);
  });

  it('should return 0 for same coordinates', () => {
    const point: Location = { lat: 40.7128, lng: -74.006 };
    const distance = calculateDistance(point, point);
    expect(distance).toBe(0);
  });

  it('should handle negative coordinates', () => {
    const point1: Location = { lat: -33.8688, lng: 151.2093 }; // Sydney
    const point2: Location = { lat: -37.8136, lng: 144.9631 }; // Melbourne

    const distance = calculateDistance(point1, point2);

    // Distance should be approximately 713 km (713000 meters)
    expect(distance).toBeGreaterThan(700000);
    expect(distance).toBeLessThan(725000);
  });
});

describe('formatDistance', () => {
  it('should format distance in feet for short distances', () => {
    const result = formatDistance(100); // 100 meters
    expect(result).toBe('328 ft');
  });

  it('should format distance in miles for long distances', () => {
    const result = formatDistance(5000); // 5000 meters
    expect(result).toBe('3.1 mi');
  });

  it('should round feet to nearest whole number', () => {
    const result = formatDistance(50); // 50 meters = 164.042 feet
    expect(result).toBe('164 ft');
  });

  it('should format miles with one decimal place', () => {
    const result = formatDistance(1609.34); // 1 mile exactly
    expect(result).toBe('1.0 mi');
  });

  it('should use miles for distances >= 0.1 miles', () => {
    const result = formatDistance(161); // 0.1 miles
    expect(result).toBe('0.1 mi');
  });

  it('should use feet for distances < 0.1 miles', () => {
    const result = formatDistance(160); // Just under 0.1 miles
    expect(result).toBe('525 ft');
  });
});
