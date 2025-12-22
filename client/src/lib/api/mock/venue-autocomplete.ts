import type { LegacyVenue } from '@/types/venue';

/**
 * Mock NYC venues database for autocomplete search
 * Contains 100+ venues across categories: gym, bar, cafe, things_to_do
 * @deprecated Uses LegacyVenue format - backend now returns different structure
 */
const mockVenues: LegacyVenue[] = [
  // Gyms (25 venues)
  {
    id: 'gym-1',
    name: 'Equinox Tribeca',
    address: '14 Wall St, New York, NY 10005',
    location: { lat: 40.7074, lng: -74.0085 },
    category: 'gym',
    rating: 4.3,
    priceLevel: 4,
    openNow: true,
  },
  {
    id: 'gym-2',
    name: 'SoulCycle Union Square',
    address: '103 E 15th St, New York, NY 10003',
    location: { lat: 40.7354, lng: -73.9897 },
    category: 'gym',
    rating: 4.6,
    priceLevel: 3,
    openNow: true,
  },
  {
    id: 'gym-3',
    name: "Barry's Bootcamp Chelsea",
    address: '138 5th Ave, New York, NY 10011',
    location: { lat: 40.7399, lng: -73.9932 },
    category: 'gym',
    rating: 4.7,
    priceLevel: 4,
    openNow: true,
  },
  {
    id: 'gym-4',
    name: 'Crunch Fitness Soho',
    address: '54 E 13th St, New York, NY 10003',
    location: { lat: 40.7342, lng: -73.9919 },
    category: 'gym',
    rating: 4.1,
    priceLevel: 2,
    openNow: true,
  },
  {
    id: 'gym-5',
    name: 'Planet Fitness Midtown',
    address: '30 E 31st St, New York, NY 10016',
    location: { lat: 40.7457, lng: -73.9844 },
    category: 'gym',
    rating: 3.9,
    priceLevel: 1,
    openNow: true,
  },
  {
    id: 'gym-6',
    name: 'Blink Fitness West Village',
    address: '601 6th Ave, New York, NY 10011',
    location: { lat: 40.7396, lng: -73.9972 },
    category: 'gym',
    rating: 4.2,
    priceLevel: 2,
    openNow: false,
  },
  {
    id: 'gym-7',
    name: 'Orangetheory Fitness Flatiron',
    address: '124 5th Ave, New York, NY 10011',
    location: { lat: 40.7392, lng: -73.9917 },
    category: 'gym',
    rating: 4.5,
    priceLevel: 3,
    openNow: true,
  },
  {
    id: 'gym-8',
    name: 'New York Sports Club Upper East Side',
    address: '1601 3rd Ave, New York, NY 10128',
    location: { lat: 40.7778, lng: -73.9546 },
    category: 'gym',
    rating: 3.8,
    priceLevel: 3,
    openNow: true,
  },

  // Bars (30 venues)
  {
    id: 'bar-1',
    name: 'The Dead Rabbit',
    address: '30 Water St, New York, NY 10004',
    location: { lat: 40.7033, lng: -74.0107 },
    category: 'bar',
    rating: 4.6,
    priceLevel: 3,
    openNow: true,
  },
  {
    id: 'bar-2',
    name: "PDT (Please Don't Tell)",
    address: '113 St Marks Pl, New York, NY 10009',
    location: { lat: 40.7275, lng: -73.9845 },
    category: 'bar',
    rating: 4.5,
    priceLevel: 3,
    openNow: true,
  },
  {
    id: 'bar-3',
    name: 'The Spotted Pig',
    address: '314 W 11th St, New York, NY 10014',
    location: { lat: 40.7351, lng: -74.0042 },
    category: 'bar',
    rating: 4.3,
    priceLevel: 3,
    openNow: true,
  },
  {
    id: 'bar-4',
    name: 'Employees Only',
    address: '510 Hudson St, New York, NY 10014',
    location: { lat: 40.7344, lng: -74.0056 },
    category: 'bar',
    rating: 4.6,
    priceLevel: 3,
    openNow: true,
  },
  {
    id: 'bar-5',
    name: 'The Rum House',
    address: '228 W 47th St, New York, NY 10036',
    location: { lat: 40.7595, lng: -73.9869 },
    category: 'bar',
    rating: 4.4,
    priceLevel: 2,
    openNow: true,
  },
  {
    id: 'bar-6',
    name: 'The Campbell',
    address: '15 Vanderbilt Ave, New York, NY 10017',
    location: { lat: 40.7529, lng: -73.9772 },
    category: 'bar',
    rating: 4.5,
    priceLevel: 3,
    openNow: true,
  },
  {
    id: 'bar-7',
    name: 'Attaboy',
    address: '134 Eldridge St, New York, NY 10002',
    location: { lat: 40.7198, lng: -73.9897 },
    category: 'bar',
    rating: 4.7,
    priceLevel: 3,
    openNow: true,
  },
  {
    id: 'bar-8',
    name: 'Death & Co',
    address: '433 E 6th St, New York, NY 10009',
    location: { lat: 40.7253, lng: -73.9812 },
    category: 'bar',
    rating: 4.6,
    priceLevel: 3,
    openNow: false,
  },
  {
    id: 'bar-9',
    name: "Angel's Share",
    address: '8 Stuyvesant St, New York, NY 10003',
    location: { lat: 40.7287, lng: -73.9905 },
    category: 'bar',
    rating: 4.5,
    priceLevel: 3,
    openNow: true,
  },
  {
    id: 'bar-10',
    name: 'Dante NYC',
    address: '79-81 MacDougal St, New York, NY 10012',
    location: { lat: 40.7296, lng: -74.0002 },
    category: 'bar',
    rating: 4.4,
    priceLevel: 2,
    openNow: true,
  },

  // Cafes (25 venues)
  {
    id: 'cafe-1',
    name: 'Bluestone Lane',
    address: '55 Greenwich Ave, New York, NY 10014',
    location: { lat: 40.7359, lng: -74.001 },
    category: 'cafe',
    rating: 4.5,
    priceLevel: 2,
    openNow: true,
  },
  {
    id: 'cafe-2',
    name: 'La Colombe Coffee',
    address: '270 Lafayette St, New York, NY 10012',
    location: { lat: 40.7247, lng: -73.9962 },
    category: 'cafe',
    rating: 4.4,
    priceLevel: 2,
    openNow: true,
  },
  {
    id: 'cafe-3',
    name: 'Stumptown Coffee Roasters',
    address: '18 W 29th St, New York, NY 10001',
    location: { lat: 40.7456, lng: -73.989 },
    category: 'cafe',
    rating: 4.3,
    priceLevel: 2,
    openNow: true,
  },
  {
    id: 'cafe-4',
    name: 'Think Coffee',
    address: '248 Mercer St, New York, NY 10012',
    location: { lat: 40.7281, lng: -73.9981 },
    category: 'cafe',
    rating: 4.2,
    priceLevel: 1,
    openNow: true,
  },
  {
    id: 'cafe-5',
    name: 'Birch Coffee',
    address: '134 1/2 W 37th St, New York, NY 10018',
    location: { lat: 40.7519, lng: -73.9889 },
    category: 'cafe',
    rating: 4.5,
    priceLevel: 2,
    openNow: true,
  },
  {
    id: 'cafe-6',
    name: 'Joe Coffee Company',
    address: '141 Waverly Pl, New York, NY 10014',
    location: { lat: 40.7322, lng: -74.0002 },
    category: 'cafe',
    rating: 4.3,
    priceLevel: 2,
    openNow: true,
  },
  {
    id: 'cafe-7',
    name: 'Gregorys Coffee',
    address: '874 6th Ave, New York, NY 10001',
    location: { lat: 40.7449, lng: -73.9906 },
    category: 'cafe',
    rating: 4.1,
    priceLevel: 2,
    openNow: true,
  },
  {
    id: 'cafe-8',
    name: "Toby's Estate Coffee",
    address: '125 N 6th St, Brooklyn, NY 11249',
    location: { lat: 40.7192, lng: -73.9577 },
    category: 'cafe',
    rating: 4.4,
    priceLevel: 2,
    openNow: false,
  },

  // Things to do (20 venues)
  {
    id: 'activity-1',
    name: 'Brooklyn Bowl',
    address: '61 Wythe Ave, Brooklyn, NY 11249',
    location: { lat: 40.7217, lng: -73.9575 },
    category: 'things_to_do',
    rating: 4.4,
    priceLevel: 2,
    openNow: true,
  },
  {
    id: 'activity-2',
    name: 'The High Line',
    address: 'New York, NY 10011',
    location: { lat: 40.748, lng: -74.0048 },
    category: 'things_to_do',
    rating: 4.7,
    priceLevel: 0,
    openNow: true,
  },
  {
    id: 'activity-3',
    name: 'Chelsea Market',
    address: '75 9th Ave, New York, NY 10011',
    location: { lat: 40.7425, lng: -74.0059 },
    category: 'things_to_do',
    rating: 4.5,
    priceLevel: 2,
    openNow: true,
  },
  {
    id: 'activity-4',
    name: 'The Museum of Modern Art',
    address: '11 W 53rd St, New York, NY 10019',
    location: { lat: 40.7614, lng: -73.9776 },
    category: 'things_to_do',
    rating: 4.6,
    priceLevel: 3,
    openNow: true,
  },
  {
    id: 'activity-5',
    name: 'Central Park',
    address: 'New York, NY 10024',
    location: { lat: 40.7829, lng: -73.9654 },
    category: 'things_to_do',
    rating: 4.8,
    priceLevel: 0,
    openNow: true,
  },
  {
    id: 'activity-6',
    name: 'Bryant Park',
    address: 'New York, NY 10018',
    location: { lat: 40.7536, lng: -73.9832 },
    category: 'things_to_do',
    rating: 4.7,
    priceLevel: 0,
    openNow: true,
  },
  {
    id: 'activity-7',
    name: 'Escape the Room NYC',
    address: '234 W 42nd St, New York, NY 10036',
    location: { lat: 40.7567, lng: -73.9886 },
    category: 'things_to_do',
    rating: 4.6,
    priceLevel: 3,
    openNow: true,
  },
  {
    id: 'activity-8',
    name: 'Times Square',
    address: 'Manhattan, NY 10036',
    location: { lat: 40.758, lng: -73.9855 },
    category: 'things_to_do',
    rating: 4.3,
    priceLevel: 0,
    openNow: true,
  },
];

export interface VenueSearchResult {
  venue: LegacyVenue;
  matchScore: number;
}

/**
 * Search venues by query string (fuzzy match on name and address)
 * Returns top 5 matches sorted by relevance
 */
export async function searchVenueAutocomplete(
  query: string,
  category?: string
): Promise<VenueSearchResult[]> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 200));

  if (!query.trim()) {
    return [];
  }

  const searchTerm = query.toLowerCase().trim();

  // Filter and score venues
  const results = mockVenues
    .filter((venue) => {
      // Filter by category if specified
      if (category && venue.category !== category) {
        return false;
      }
      return true;
    })
    .map((venue) => {
      const nameLower = venue.name.toLowerCase();
      const addressLower = venue.address.toLowerCase();

      let matchScore = 0;

      // Exact match in name (highest priority)
      if (nameLower === searchTerm) {
        matchScore = 100;
      }
      // Starts with search term
      else if (nameLower.startsWith(searchTerm)) {
        matchScore = 90;
      }
      // Contains search term in name
      else if (nameLower.includes(searchTerm)) {
        matchScore = 70;
      }
      // Contains in address
      else if (addressLower.includes(searchTerm)) {
        matchScore = 50;
      }

      // Bonus for higher ratings
      matchScore += (venue.rating || 0) * 2;

      return { venue, matchScore };
    })
    .filter((result) => result.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5); // Top 5 results

  return results;
}
