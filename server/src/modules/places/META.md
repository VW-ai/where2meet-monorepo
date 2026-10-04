# Places

`store.ts` reads Venue summaries and converts stored decimal values into domain numbers. Meetings receives these summaries through the public Places interface, without accessing Venue directly.

M1 does not fetch Google data or update venue records. Venue detail HTTP requests, search, and routing remain explicitly unavailable.
