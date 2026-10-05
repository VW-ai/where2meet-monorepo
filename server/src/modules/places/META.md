# Places

`store.ts` reads Venue summaries and converts stored decimal values into domain numbers. Meetings receives these summaries through the public Places interface, without accessing Venue directly.

`geocoder.ts` validates Google Geocoding responses and exposes found, not-found, or unavailable results. A single configured deadline covers at most three attempts. Network failures, HTTP 429 and server failures, quota limits, and Google `UNKNOWN_ERROR` responses retry with short waits. Denied requests, invalid responses, and addresses with no matches do not retry. Original addresses and API keys never appear in application errors or logs. M2 does not cache geocoding results.

Participant geocoding does not create or update Venue rows. Venue detail HTTP requests, search, and routing remain explicitly unavailable.
