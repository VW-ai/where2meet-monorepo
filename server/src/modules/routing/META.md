# Routing

`types.ts` exposes coordinate-only routing with opaque origin IDs. Every input origin receives a found, no-route, or unavailable result with the same ID. Routing has no database, participant, credential, or private-address knowledge.

`provider.ts` validates the first Google route and leg, numeric distances and durations, and the encoded polyline. Valid zero values remain zero. A ten-second batch deadline includes cache reads, retry waits, and writes. At most four requests run concurrently. Unstarted or aborted origins remain unavailable, and transient failures receive at most three attempts.

Only found routes enter the versioned one-hour cache. Keys include exact origin, destination, mode, and configured provider endpoint. IDs are attached after reading the cached route. Corrupt entries are misses. HTTP owns the legacy imperial distance and English duration text.
