# Places

`store.ts` reads Venue summaries and converts stored decimal values into domain numbers. Meetings receives these summaries through the public Places interface, without accessing Venue directly. A summary is display data, not proof of destination provenance. Imported nonempty photo strings become availability hints. HTTP generates their owned photo URLs, and no imported URL or photo reference is returned or fetched.

`geocoder.ts` validates Google Geocoding responses and exposes found, not-found, or unavailable results. A single configured deadline covers at most three attempts. Network failures, HTTP 429 and server failures, quota limits, and Google `UNKNOWN_ERROR` responses retry with short waits. Denied requests, invalid responses, and addresses with no matches do not retry. Original addresses and API keys never appear in application errors or logs. M2 does not cache geocoding results.

`provider.ts` parses Places responses and every versioned cache entry. Requested and returned detail IDs must match. Search combines text before distinct categories, keeps the first duplicate ID, and sorts rating descending with missing ratings last. It stops on any failed subsearch. Two concurrent subsearches share a ten-second budget. Each Places lookup has a five-second total deadline. Transient failures receive at most three attempts with 100 ms and 400 ms waits. Deadlines include cache waiting.

Details await the summary upsert before success. Search does not persist summaries. Destination and photo operations read provider details or the validated details cache without depending on Venue or requiring persistence. Participant geocoding does not write Venue. Future vote writes must obtain authority through Places rather than accept client venueData as global truth.

The normalized private cache retains the trusted first photo reference. Photo resolution uses fixed width 400 and manual redirects within a ten-second total budget. It returns only an HTTPS location on lh3.googleusercontent.com without credentials, query, fragment, nonstandard port, or the server key. HTTP issues the redirect with no-store. Missing photos and upstream failures remain distinct.
