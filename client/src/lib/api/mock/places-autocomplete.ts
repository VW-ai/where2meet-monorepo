/**
 * Mock Google Places Autocomplete API
 * Provides autocomplete functionality with 50+ real NYC addresses
 */

export interface PlacePrediction {
  place_id: string;
  main_text: string; // Street address
  secondary_text: string; // City, State
  full_address: string; // Complete address
}

// 50+ Real NYC addresses across all boroughs
const MOCK_NYC_ADDRESSES: PlacePrediction[] = [
  // Manhattan
  {
    place_id: 'place_001',
    main_text: '350 5th Ave',
    secondary_text: 'New York, NY 10118',
    full_address: '350 5th Ave, New York, NY 10118', // Empire State Building
  },
  {
    place_id: 'place_002',
    main_text: '1 Times Square',
    secondary_text: 'New York, NY 10036',
    full_address: '1 Times Square, New York, NY 10036',
  },
  {
    place_id: 'place_003',
    main_text: '89 E 42nd St',
    secondary_text: 'New York, NY 10017',
    full_address: '89 E 42nd St, New York, NY 10017', // Grand Central Terminal
  },
  {
    place_id: 'place_004',
    main_text: '20 W 34th St',
    secondary_text: 'New York, NY 10001',
    full_address: '20 W 34th St, New York, NY 10001', // Madison Square Garden
  },
  {
    place_id: 'place_005',
    main_text: '1071 5th Ave',
    secondary_text: 'New York, NY 10128',
    full_address: '1071 5th Ave, New York, NY 10128', // Guggenheim Museum
  },
  {
    place_id: 'place_006',
    main_text: '11 Wall St',
    secondary_text: 'New York, NY 10005',
    full_address: '11 Wall St, New York, NY 10005',
  },
  {
    place_id: 'place_007',
    main_text: '725 5th Ave',
    secondary_text: 'New York, NY 10022',
    full_address: '725 5th Ave, New York, NY 10022', // Trump Tower
  },
  {
    place_id: 'place_008',
    main_text: '30 Rockefeller Plaza',
    secondary_text: 'New York, NY 10112',
    full_address: '30 Rockefeller Plaza, New York, NY 10112',
  },
  {
    place_id: 'place_009',
    main_text: '10 Columbus Circle',
    secondary_text: 'New York, NY 10019',
    full_address: '10 Columbus Circle, New York, NY 10019', // Time Warner Center
  },
  {
    place_id: 'place_010',
    main_text: '175 Greenwich St',
    secondary_text: 'New York, NY 10007',
    full_address: '175 Greenwich St, New York, NY 10007', // One World Trade Center
  },

  // Brooklyn
  {
    place_id: 'place_011',
    main_text: '334 Furman St',
    secondary_text: 'Brooklyn, NY 11201',
    full_address: '334 Furman St, Brooklyn, NY 11201', // Brooklyn Bridge Park
  },
  {
    place_id: 'place_012',
    main_text: '200 Eastern Pkwy',
    secondary_text: 'Brooklyn, NY 11238',
    full_address: '200 Eastern Pkwy, Brooklyn, NY 11238', // Brooklyn Museum
  },
  {
    place_id: 'place_013',
    main_text: '1000 Dean St',
    secondary_text: 'Brooklyn, NY 11238',
    full_address: '1000 Dean St, Brooklyn, NY 11238', // Barclays Center
  },
  {
    place_id: 'place_014',
    main_text: '17 Smith St',
    secondary_text: 'Brooklyn, NY 11201',
    full_address: '17 Smith St, Brooklyn, NY 11201',
  },
  {
    place_id: 'place_015',
    main_text: '450 Flatbush Ave',
    secondary_text: 'Brooklyn, NY 11225',
    full_address: '450 Flatbush Ave, Brooklyn, NY 11225',
  },
  {
    place_id: 'place_016',
    main_text: '102 Bedford Ave',
    secondary_text: 'Brooklyn, NY 11249',
    full_address: '102 Bedford Ave, Brooklyn, NY 11249',
  },
  {
    place_id: 'place_017',
    main_text: '990 Dean St',
    secondary_text: 'Brooklyn, NY 11238',
    full_address: '990 Dean St, Brooklyn, NY 11238',
  },
  {
    place_id: 'place_018',
    main_text: '285 Fulton St',
    secondary_text: 'Brooklyn, NY 11201',
    full_address: '285 Fulton St, Brooklyn, NY 11201',
  },
  {
    place_id: 'place_019',
    main_text: '93 N 6th St',
    secondary_text: 'Brooklyn, NY 11249',
    full_address: '93 N 6th St, Brooklyn, NY 11249',
  },
  {
    place_id: 'place_020',
    main_text: '5 Ninth Ave',
    secondary_text: 'Brooklyn, NY 11217',
    full_address: '5 Ninth Ave, Brooklyn, NY 11217',
  },

  // Queens
  {
    place_id: 'place_021',
    main_text: '123-01 Roosevelt Ave',
    secondary_text: 'Queens, NY 11368',
    full_address: '123-01 Roosevelt Ave, Queens, NY 11368', // Citi Field
  },
  {
    place_id: 'place_022',
    main_text: '108-64 Ditmars Blvd',
    secondary_text: 'Queens, NY 11369',
    full_address: '108-64 Ditmars Blvd, Queens, NY 11369',
  },
  {
    place_id: 'place_023',
    main_text: '36-01 35th Ave',
    secondary_text: 'Queens, NY 11106',
    full_address: '36-01 35th Ave, Queens, NY 11106',
  },
  {
    place_id: 'place_024',
    main_text: '31-00 47th Ave',
    secondary_text: 'Queens, NY 11101',
    full_address: '31-00 47th Ave, Queens, NY 11101',
  },
  {
    place_id: 'place_025',
    main_text: '40-19 Gleane St',
    secondary_text: 'Queens, NY 11373',
    full_address: '40-19 Gleane St, Queens, NY 11373',
  },
  {
    place_id: 'place_026',
    main_text: '90-15 Queens Blvd',
    secondary_text: 'Queens, NY 11373',
    full_address: '90-15 Queens Blvd, Queens, NY 11373',
  },
  {
    place_id: 'place_027',
    main_text: '23-10 Steinway St',
    secondary_text: 'Queens, NY 11105',
    full_address: '23-10 Steinway St, Queens, NY 11105',
  },
  {
    place_id: 'place_028',
    main_text: '30-50 Whitestone Expy',
    secondary_text: 'Queens, NY 11354',
    full_address: '30-50 Whitestone Expy, Queens, NY 11354',
  },
  {
    place_id: 'place_029',
    main_text: '82-68 Austin St',
    secondary_text: 'Queens, NY 11373',
    full_address: '82-68 Austin St, Queens, NY 11373',
  },
  {
    place_id: 'place_030',
    main_text: '13-05 44th Ave',
    secondary_text: 'Queens, NY 11101',
    full_address: '13-05 44th Ave, Queens, NY 11101',
  },

  // Bronx
  {
    place_id: 'place_031',
    main_text: '1 E 161st St',
    secondary_text: 'Bronx, NY 10451',
    full_address: '1 E 161st St, Bronx, NY 10451', // Yankee Stadium
  },
  {
    place_id: 'place_032',
    main_text: '2300 Southern Blvd',
    secondary_text: 'Bronx, NY 10460',
    full_address: '2300 Southern Blvd, Bronx, NY 10460', // Bronx Zoo
  },
  {
    place_id: 'place_033',
    main_text: '610 E 186th St',
    secondary_text: 'Bronx, NY 10458',
    full_address: '610 E 186th St, Bronx, NY 10458',
  },
  {
    place_id: 'place_034',
    main_text: '851 Grand Concourse',
    secondary_text: 'Bronx, NY 10451',
    full_address: '851 Grand Concourse, Bronx, NY 10451',
  },
  {
    place_id: 'place_035',
    main_text: '600 E Tremont Ave',
    secondary_text: 'Bronx, NY 10457',
    full_address: '600 E Tremont Ave, Bronx, NY 10457',
  },
  {
    place_id: 'place_036',
    main_text: '260 E 188th St',
    secondary_text: 'Bronx, NY 10458',
    full_address: '260 E 188th St, Bronx, NY 10458',
  },
  {
    place_id: 'place_037',
    main_text: '3424 Kossuth Ave',
    secondary_text: 'Bronx, NY 10467',
    full_address: '3424 Kossuth Ave, Bronx, NY 10467',
  },
  {
    place_id: 'place_038',
    main_text: '890 McLean Ave',
    secondary_text: 'Bronx, NY 10704',
    full_address: '890 McLean Ave, Bronx, NY 10704',
  },
  {
    place_id: 'place_039',
    main_text: '4380 Katonah Ave',
    secondary_text: 'Bronx, NY 10470',
    full_address: '4380 Katonah Ave, Bronx, NY 10470',
  },
  {
    place_id: 'place_040',
    main_text: '2510 Arthur Ave',
    secondary_text: 'Bronx, NY 10458',
    full_address: '2510 Arthur Ave, Bronx, NY 10458',
  },

  // Staten Island
  {
    place_id: 'place_041',
    main_text: '1000 Richmond Ter',
    secondary_text: 'Staten Island, NY 10301',
    full_address: '1000 Richmond Ter, Staten Island, NY 10301',
  },
  {
    place_id: 'place_042',
    main_text: '75 Richmond Ter',
    secondary_text: 'Staten Island, NY 10301',
    full_address: '75 Richmond Ter, Staten Island, NY 10301',
  },
  {
    place_id: 'place_043',
    main_text: '2800 Victory Blvd',
    secondary_text: 'Staten Island, NY 10314',
    full_address: '2800 Victory Blvd, Staten Island, NY 10314',
  },
  {
    place_id: 'place_044',
    main_text: '1000 Clove Rd',
    secondary_text: 'Staten Island, NY 10301',
    full_address: '1000 Clove Rd, Staten Island, NY 10301',
  },
  {
    place_id: 'place_045',
    main_text: '2052 Forest Ave',
    secondary_text: 'Staten Island, NY 10303',
    full_address: '2052 Forest Ave, Staten Island, NY 10303',
  },

  // More Manhattan
  {
    place_id: 'place_046',
    main_text: '240 Centre St',
    secondary_text: 'New York, NY 10013',
    full_address: '240 Centre St, New York, NY 10013',
  },
  {
    place_id: 'place_047',
    main_text: '455 Central Park W',
    secondary_text: 'New York, NY 10025',
    full_address: '455 Central Park W, New York, NY 10025',
  },
  {
    place_id: 'place_048',
    main_text: '70 Pine St',
    secondary_text: 'New York, NY 10005',
    full_address: '70 Pine St, New York, NY 10005',
  },
  {
    place_id: 'place_049',
    main_text: '405 Lexington Ave',
    secondary_text: 'New York, NY 10174',
    full_address: '405 Lexington Ave, New York, NY 10174', // Chrysler Building
  },
  {
    place_id: 'place_050',
    main_text: '2 Lincoln Square',
    secondary_text: 'New York, NY 10023',
    full_address: '2 Lincoln Square, New York, NY 10023',
  },
  {
    place_id: 'place_051',
    main_text: '995 5th Ave',
    secondary_text: 'New York, NY 10028',
    full_address: '995 5th Ave, New York, NY 10028', // Met Museum
  },
  {
    place_id: 'place_052',
    main_text: '212 W 18th St',
    secondary_text: 'New York, NY 10011',
    full_address: '212 W 18th St, New York, NY 10011',
  },
];

/**
 * Mock Google Places Autocomplete
 * Performs fuzzy search on NYC addresses
 * @param query Search query string
 * @returns Array of matching place predictions (max 5)
 */
export async function mockPlacesAutocomplete(query: string): Promise<PlacePrediction[]> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 150));

  if (!query || query.length < 2) {
    return [];
  }

  const normalizedQuery = query.toLowerCase().trim();

  // Fuzzy search: match against main_text, secondary_text, or full_address
  const matches = MOCK_NYC_ADDRESSES.filter((place) => {
    const searchableText =
      `${place.main_text} ${place.secondary_text} ${place.full_address}`.toLowerCase();
    return searchableText.includes(normalizedQuery);
  });

  // Return top 5 matches
  return matches.slice(0, 5);
}

/**
 * Get place details by place_id
 * @param placeId Place ID
 * @returns Place prediction or null if not found
 */
export function getPlaceById(placeId: string): PlacePrediction | null {
  return MOCK_NYC_ADDRESSES.find((place) => place.place_id === placeId) || null;
}

/**
 * Get all available addresses (for testing)
 * @returns All mock addresses
 */
export function getAllMockAddresses(): PlacePrediction[] {
  return MOCK_NYC_ADDRESSES;
}
