'use client';

/**
 * Liked Venues Section
 *
 * TODO: This component needs backend API support to fetch liked venues across all user events.
 * Previously relied on deprecated global state (likedVenueData) which has been removed.
 *
 * Requirements for re-enabling:
 * 1. Backend endpoint: GET /api/users/me/liked-venues
 * 2. Returns all venues the user has voted for across all their events
 * 3. Include venue details (name, address, photo, rating, etc.)
 *
 * Current state: Disabled (returns null) until backend support is added.
 */

export function LikedVenuesSection() {
  // Disabled until backend API is available
  return null;

  // Original implementation (commented out):
  /*
  const { likedVenueData, savedVenues } = useMeetingStore();

  // Get all liked venues as an array
  const likedVenues = Object.values(likedVenueData);

  if (likedVenues.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">Liked Venues</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {likedVenues.map((venue) => (
          <div key={venue.id} ...>
            ...venue card UI...
          </div>
        ))}
      </div>
    </div>
  );
  */
}
