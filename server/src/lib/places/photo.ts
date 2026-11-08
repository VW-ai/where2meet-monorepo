/**
 * Google Places photos behind this API.
 *
 * Google's photo URL needs the server key, so clients get a URL on this API
 * instead and the server looks the photo up with the key.
 * @module lib/places/photo
 */

import { config, publicApiUrl } from "../config.js";

export const PHOTO_WIDTH = 400;

const GOOGLE_PHOTO_URL = "https://maps.googleapis.com/maps/api/place/photo";

/**
 * The URL clients load for a Google photo reference. The width keeps Google's
 * name because the iOS ticket raises `maxwidth` for a full-screen photo.
 */
export function photoProxyUrl(photoReference: string, maxWidth = PHOTO_WIDTH): string {
  const params = new URLSearchParams({ ref: photoReference, maxwidth: String(maxWidth) });
  return `${publicApiUrl}/api/places/photo?${params.toString()}`;
}

/**
 * The photo URL to send a client for a stored one. Venues saved before the
 * photo route hold Google's URL with the key in it.
 */
export function publicPhotoUrl(storedUrl: string | null): string | null {
  if (!storedUrl?.startsWith(GOOGLE_PHOTO_URL)) return storedUrl;
  const params = new URL(storedUrl).searchParams;
  const photoReference = params.get("photoreference") ?? params.get("photo_reference");
  if (!photoReference) return null;
  return photoProxyUrl(photoReference, Number(params.get("maxwidth")) || PHOTO_WIDTH);
}

/**
 * Asks Google where a photo lives. Google answers with a redirect to an
 * image host that needs no key. Returns null when Google has no such photo.
 */
export async function resolvePlacePhoto(
  photoReference: string,
  maxWidth: number
): Promise<string | null> {
  const params = new URLSearchParams({
    photoreference: photoReference,
    maxwidth: String(maxWidth),
    key: config.GOOGLE_MAPS_API_KEY,
  });
  const response = await fetch(`${GOOGLE_PHOTO_URL}?${params.toString()}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(config.PLACES_TIMEOUT_MS),
  });
  const location = response.headers.get("location");
  if (response.status >= 300 && response.status < 400 && location) return location;
  if (response.status >= 400 && response.status < 500) return null;
  throw new Error(`Google photo lookup failed with status ${String(response.status)}`);
}
