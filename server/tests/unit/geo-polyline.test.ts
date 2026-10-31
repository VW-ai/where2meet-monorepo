/**
 * Unit tests for the Google encoded polyline encoder.
 */

import { describe, it, expect } from "vitest";
import { encodePolyline } from "../../src/lib/geo/polyline.js";

describe("encodePolyline", () => {
  it("matches Google's documented example", () => {
    // From https://developers.google.com/maps/documentation/utilities/polylinealgorithm
    const path = [
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ];
    expect(encodePolyline(path)).toBe("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
  });

  it("returns an empty string for an empty path", () => {
    expect(encodePolyline([])).toBe("");
  });
});
