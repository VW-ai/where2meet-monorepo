/** Each key's grandfathered names: a post's slug or an image's file_name. */
export type NamesByKey = Readonly<Record<string, readonly string[]>>;

export interface Grandfathered {
  /** Posts that share a city and an occasion, by `<city>/<occasion>`. */
  occasions: NamesByKey;
  /** Posts past the limit for one place, by place_id. */
  places: NamesByKey;
  /** Images that share one Commons photo, by source_url. */
  photos: NamesByKey;
}

/**
 * The files that were past a sharing limit on main when the limits came in, on 2026-11-17.
 * They keep their share, and no other file may join one. A list only ever shrinks.
 */
export const GRANDFATHERED: Grandfathered = {
  occasions: {
    'boston/baby-shower': [
      'baby-shower-venue-back-bay',
      'places-to-have-baby-shower-downtown-boston',
      'where-to-have-baby-shower-boston',
    ],
    'boston/book-club': ['book-club-meeting-place-back-bay', 'where-to-host-book-club-boston'],
    'boston/class-reunion': [
      'class-reunion-ideas-downtown-boston',
      'class-reunion-venue-back-bay',
      'where-to-hold-class-reunion-boston',
    ],
    'boston/date-night': [
      'date-night-spots-downtown-boston',
      'date-spot-ideas-boston',
      'first-date-spot-back-bay',
    ],
    'boston/family-reunion': [
      'family-reunion-ideas-downtown-boston',
      'family-reunion-venue-back-bay',
      'where-to-have-family-reunion-boston',
    ],
    'boston/game-night': ['board-game-bar-boston', 'game-night-spots-back-bay'],
    'boston/graduation-celebration': [
      'graduation-celebration-ideas-downtown-boston',
      'graduation-dinner-back-bay',
      'graduation-party-venue-boston',
    ],
    'boston/group-dinner': [
      'group-dinner-restaurants-downtown-boston',
      'restaurant-big-group-boston',
      'where-to-have-group-dinner-back-bay',
    ],
    'boston/holiday-party': ['holiday-party-venue-boston', 'office-holiday-party-venue-back-bay'],
    'boston/networking-meetup': [
      'networking-event-venue-boston',
      'where-to-host-networking-event-back-bay',
    ],
    'boston/pickup-basketball': [
      'basketball-courts-near-me-boston',
      'indoor-basketball-courts-near-me-free-back-bay',
    ],
    'boston/study-session': ['group-study-spots-back-bay', 'study-group-meeting-place-boston'],
    'boston/team-meeting': [
      'team-meeting-spots-downtown-boston',
      'team-meeting-venue-back-bay',
      'where-to-meet-team-meeting-boston',
    ],
    'boston/watch-party': ['watch-party-bar-back-bay', 'where-to-watch-the-game-boston'],
    'boston/weekend-hangout': [
      'places-to-hang-out-downtown-boston',
      'things-to-do-with-friends-back-bay',
      'where-to-hang-out-with-friends-boston',
    ],
    'new-york/date-night': ['date-night-bars-manhattan', 'how-to-pick-a-date-spot'],
    'new-york/pickup-basketball': [
      'basketball-courts-near-me-free-indoor-nyc',
      'pickup-basketball-new-york',
    ],
    'new-york/team-meeting': [
      'how-to-choose-a-team-meeting-location',
      'team-meeting-location-manhattan',
    ],
  },
  places: {
    ChIJ0_a3Qgx644kRH4_DExyLsm0: [
      'book-club-meeting-place-back-bay',
      'things-to-do-with-friends-back-bay',
      'where-to-host-book-club-boston',
      'where-to-host-networking-event-back-bay',
    ],
    ChIJ2X25uw9644kRGG8gByNprGU: [
      'book-club-meeting-place-back-bay',
      'class-reunion-venue-back-bay',
      'family-reunion-venue-back-bay',
      'first-date-spot-back-bay',
      'graduation-dinner-back-bay',
      'indoor-basketball-courts-near-me-free-back-bay',
      'networking-event-venue-boston',
      'office-holiday-party-venue-back-bay',
      'team-meeting-venue-back-bay',
      'things-to-do-with-friends-back-bay',
      'watch-party-bar-back-bay',
      'where-to-host-networking-event-back-bay',
    ],
    ChIJ2XHkQoZw44kRuMIaSkTas9E: [
      'date-night-spots-downtown-boston',
      'date-spot-ideas-boston',
      'networking-event-venue-boston',
      'places-to-hang-out-downtown-boston',
    ],
    ChIJ8duYVwB744kR2CGahmWzCLY: [
      'first-date-spot-back-bay',
      'game-night-spots-back-bay',
      'things-to-do-with-friends-back-bay',
      'where-to-hang-out-with-friends-boston',
    ],
    ChIJ99tZ9Ax644kRF96OnpZdQY8: [
      'baby-shower-venue-back-bay',
      'class-reunion-venue-back-bay',
      'family-reunion-venue-back-bay',
      'office-holiday-party-venue-back-bay',
      'where-to-have-family-reunion-boston',
    ],
    ChIJc3pn3XR644kRe7W9ViVyWbE: [
      'group-study-spots-back-bay',
      'networking-event-venue-boston',
      'team-meeting-venue-back-bay',
      'where-to-host-networking-event-back-bay',
      'where-to-meet-team-meeting-boston',
    ],
    ChIJH9CZLYRw44kRB96v85hlWMo: [
      'class-reunion-ideas-downtown-boston',
      'graduation-party-venue-boston',
      'places-to-have-baby-shower-downtown-boston',
      'where-to-have-baby-shower-boston',
      'where-to-have-family-reunion-boston',
    ],
    ChIJjTd23X9644kRRcFC4A99DOc: [
      'board-game-bar-boston',
      'date-spot-ideas-boston',
      'holiday-party-venue-boston',
      'where-to-hang-out-with-friends-boston',
      'where-to-hold-class-reunion-boston',
      'where-to-meet-team-meeting-boston',
    ],
    ChIJMU7XDK5744kRpfx70sxEFEI: [
      'baby-shower-venue-back-bay',
      'class-reunion-venue-back-bay',
      'family-reunion-venue-back-bay',
      'graduation-dinner-back-bay',
      'graduation-party-venue-boston',
      'office-holiday-party-venue-back-bay',
      'where-to-hold-class-reunion-boston',
    ],
    ChIJPWuhSAV644kRBAzOCF4Bqno: [
      'book-club-meeting-place-back-bay',
      'game-night-spots-back-bay',
      'group-study-spots-back-bay',
      'study-group-meeting-place-boston',
      'where-to-host-book-club-boston',
    ],
    ChIJXw7lPMV744kRWzcOcJP8pWI: [
      'baby-shower-venue-back-bay',
      'class-reunion-venue-back-bay',
      'family-reunion-venue-back-bay',
      'where-to-have-baby-shower-boston',
    ],
    ChIJZ7s5k8x744kRIY0GX_xBoo0: [
      'date-spot-ideas-boston',
      'graduation-dinner-back-bay',
      'graduation-party-venue-boston',
      'office-holiday-party-venue-back-bay',
    ],
    ChIJzR2kK3V644kRDKMMzrsZ6v8: [
      'baby-shower-venue-back-bay',
      'book-club-meeting-place-back-bay',
      'class-reunion-venue-back-bay',
      'family-reunion-venue-back-bay',
      'where-to-hold-class-reunion-boston',
    ],
  },
  photos: {
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/22/Newbury_Street%2C_Boston%2C_Massachusetts_March_2020_-_01.jpg/1280px-Newbury_Street%2C_Boston%2C_Massachusetts_March_2020_-_01.jpg':
      ['newbury-street-back-bay-march-2020.jpg', 'newbury-street-brick-storefronts-back-bay.jpg'],
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2e/Boston_Public_Library_%E2%80%93_McKim_Building_%2854923556202%29.jpg/1280px-Boston_Public_Library_%E2%80%93_McKim_Building_%2854923556202%29.jpg':
      [
        'boston-public-library-mckim-building-copley-square.jpg',
        'central-library-mckim-building-copley-square.jpg',
      ],
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/Herald_Square_wts.jpg/1280px-Herald_Square_wts.jpg':
      ['herald-square-clock-west-35th-street.jpg', 'herald-square-plaza-clock-midtown.jpg'],
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a0/The_College_Club_of_Boston_%2854954431303%29.jpg/1280px-The_College_Club_of_Boston_%2854954431303%29.jpg':
      [
        'college-club-44-commonwealth-avenue-back-bay.jpg',
        'college-club-boston-commonwealth-avenue.jpg',
      ],
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ec/Hynes_Convention_Center_station_outbound_platform_April_2025_1.jpg/1280px-Hynes_Convention_Center_station_outbound_platform_April_2025_1.jpg':
      [
        'hynes-convention-center-station-outbound-platform-green-columns.jpg',
        'hynes-convention-center-station-outbound-platform.jpg',
      ],
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fd/Fenway_Park_-_Lansdowne_Street_%2854954428668%29.jpg/1280px-Fenway_Park_-_Lansdowne_Street_%2854954428668%29.jpg':
      [
        'fenway-park-lansdowne-street-boston.jpg',
        'lansdowne-street-fenway-park-house-of-blues.jpg',
      ],
  },
};
