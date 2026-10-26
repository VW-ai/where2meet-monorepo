/**
 * Where2Meet venue categories in AMap POI type codes, and back.
 *
 * Codes come from AMap's POI classification table (V1.06, 2023-02-08).
 * @see https://lbs.amap.com/api/webservice/download
 * @module lib/amap/categories
 */

import type { VenueCategory } from "../places/index.js";

/** Type codes searched for each category, "|"-separated as AMap expects. */
export const CATEGORY_TO_AMAP_TYPES: Record<VenueCategory, string> = {
  cafe: "050500",
  // Chinese, foreign and fast-food restaurants; the 050000 group also holds cafes and bakeries.
  restaurant: "050100|050200|050300",
  bar: "080304",
  park: "110101",
  library: "140500",
  gym: "080111",
  museum: "140100",
  shopping: "060101",
  things_to_do: "110000",
};

/**
 * Google place types for AMap type code prefixes, most specific first. The
 * client picks venue icons and categories from Google type names.
 */
const TYPE_PREFIX_TO_GOOGLE_TYPE: [string, string][] = [
  ["0505", "cafe"],
  ["05", "restaurant"],
  ["080304", "bar"],
  ["0801", "gym"],
  ["1101", "park"],
  ["11", "tourist_attraction"],
  ["1401", "museum"],
  ["1405", "library"],
  ["0601", "shopping_mall"],
];

/**
 * Derives Google-style place types from an AMap type code.
 * @param typecode - AMap code, possibly several joined by "|"
 * @returns The matching Google type plus "point_of_interest"
 */
export function googleTypesForTypecode(typecode: string | undefined): string[] {
  const code = typecode?.split("|")[0] ?? "";
  const match = TYPE_PREFIX_TO_GOOGLE_TYPE.find(([prefix]) => code.startsWith(prefix));
  return match ? [match[1], "point_of_interest"] : ["point_of_interest"];
}
