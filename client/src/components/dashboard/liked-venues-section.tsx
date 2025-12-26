'use client';

import { useMeetingStore } from '@/store/useMeetingStore';
import { MapPin, Star, Heart } from 'lucide-react';

export function LikedVenuesSection() {
  const { likedVenueData, savedVenues } = useMeetingStore();

  // Get all liked venues as an array
  const likedVenues = Object.values(likedVenueData);

  if (likedVenues.length === 0) {
    return null; // Don't show section if no liked venues
  }

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">Liked Venues</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {likedVenues.map((venue) => (
          <div
            key={venue.id}
            className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
          >
            {/* Venue Image */}
            {venue.photoUrl ? (
              <div className="relative h-32 w-full overflow-hidden">
                <img src={venue.photoUrl} alt={venue.name} className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2">
                  <div className="bg-coral-500 text-white p-1.5 rounded-full shadow-md">
                    <Heart className="w-4 h-4 fill-white" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative h-32 w-full bg-gradient-to-br from-coral-50 to-lavender-50 flex items-center justify-center">
                <MapPin className="w-12 h-12 text-gray-300" />
                <div className="absolute top-2 right-2">
                  <div className="bg-coral-500 text-white p-1.5 rounded-full shadow-md">
                    <Heart className="w-4 h-4 fill-white" />
                  </div>
                </div>
              </div>
            )}

            {/* Venue Info */}
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-1">
                {venue.name}
              </h3>

              {/* Address */}
              {venue.address && (
                <p className="text-xs text-gray-500 mb-2 line-clamp-1 flex items-start gap-1">
                  <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-1">{venue.address}</span>
                </p>
              )}

              {/* Rating and Category */}
              <div className="flex items-center gap-3 text-xs">
                {venue.rating !== null && venue.rating !== undefined && (
                  <div className="flex items-center gap-1 text-gray-600">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span className="font-medium">{venue.rating.toFixed(1)}</span>
                  </div>
                )}
                {venue.types && venue.types.length > 0 && (
                  <span className="text-gray-500 capitalize">
                    {venue.types[0].replace(/_/g, ' ')}
                  </span>
                )}
              </div>

              {/* Price Level */}
              {venue.priceLevel && (
                <div className="mt-2 text-xs text-gray-600">
                  <span className="font-medium">Price: </span>
                  <span className="text-coral-600">{'$'.repeat(venue.priceLevel)}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600">
          You have {savedVenues.length} liked venue{savedVenues.length !== 1 ? 's' : ''} across all
          events
        </p>
      </div>
    </div>
  );
}
