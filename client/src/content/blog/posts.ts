import {
  Briefcase,
  Coffee,
  Heart,
  Mountain,
  Plane,
  Sun,
  Users,
  Utensils,
  type IconNode,
} from 'lucide';
import type { CuratedPlace } from '@/features/guides/lib/catalog';
import { assertIsoDate } from '@/lib/seo/site-pages';

/**
 * The homepage's meeting-type chips, plus occasions only the blog writes about.
 */
export const OCCASIONS = {
  'date-night': {
    label: 'Date night',
    icon: Heart,
  },
  'team-meeting': {
    label: 'Team meeting',
    icon: Briefcase,
  },
  'group-dinner': {
    label: 'Group dinner',
    icon: Utensils,
  },
  'coffee-catch-up': {
    label: 'Coffee catch-up',
    icon: Coffee,
  },
  'weekend-hangout': {
    label: 'Weekend hangout',
    icon: Sun,
  },
  'family-outing': {
    label: 'Family outing',
    icon: Users,
  },
  'team-offsite': {
    label: 'Team offsite',
    icon: Mountain,
  },
  'long-distance-reunion': {
    label: 'Long-distance reunion',
    icon: Plane,
  },
} satisfies Record<string, { label: string; icon: IconNode }>;

export type Occasion = keyof typeof OCCASIONS;

type IsoDate = `${number}-${number}-${number}`;

/** Share-alike licenses are left out on purpose. */
type CoverLicense = 'CC0' | 'Public domain' | 'CC BY 2.0' | 'CC BY 3.0' | 'CC BY 4.0';

/** A freely licensed photo of a place the post names, saved as `src/content/blog/covers/<slug>.jpg`. */
export interface CoverPhoto {
  place: string;
  author: string;
  license: CoverLicense;
  sourceUrl: `https://commons.wikimedia.org/wiki/File:${string}`;
}

export interface BlogPost {
  /** Also the body's file name: `src/content/blog/<slug>.mdx`. */
  slug: string;
  title: string;
  description: string;
  publishedAt: IsoDate;
  updatedAt: IsoDate;
  occasion: Occasion;
  coverAlt: string;
  coverPhoto: CoverPhoto;
  /** Real places the post names, all in one city, shown where the body writes `<Places />`. */
  examplePlaces: { title: string; places: readonly [CuratedPlace, ...CuratedPlace[]] };
}

export const BLOG_AUTHOR = 'The Where2Meet team';

const posts: BlogPost[] = [
  {
    slug: 'how-to-pick-a-restaurant-for-a-group-dinner',
    title: 'How to pick a restaurant for a group dinner',
    description:
      'Pick a restaurant your whole group can reach before the table is given away, check it seats big groups, and settle the menu and bill early.',
    publishedAt: '2026-10-08',
    updatedAt: '2026-10-08',
    occasion: 'group-dinner',
    coverAlt:
      'Street signs for West 32nd Street and Korea Way above yellow taxis on Broadway, next to the article title.',
    coverPhoto: {
      place: 'Koreatown',
      author: 'Jazz Guy',
      license: 'CC BY 2.0',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:West_32nd_Street_(Korea_Way)_@_Broadway_(2559336247).jpg',
    },
    examplePlaces: {
      title: 'Group dinner spots near the subway in New York',
      places: [
        {
          placeId: 'ChIJ99_m8KhZwokRz33z_j0NaQ8',
          label: 'miss KOREA BBQ',
          note: "A Korean barbecue restaurant in Koreatown, with food made for sharing. It's about a 3-minute walk from the Herald Square station, where the B, D, F, M, N, Q, R and W stop.",
        },
        {
          placeId: 'ChIJT4JpKxhawokRJsGwYfLpp60',
          label: 'The Malt House',
          note: "A pub and restaurant in the Financial District, close to many offices for a dinner after work. It's about a 2-minute walk from the Fulton St station, where the 2, 3, 4, 5, A, C, J and Z stop.",
        },
        {
          placeId: 'ChIJX0ngNbRbwokR2sNkLsVtQMY',
          label: 'El Zason',
          note: "A Mexican restaurant on Atlantic Avenue in Brooklyn. It's about a 5-minute walk from the Atlantic Av-Barclays Ctr station, where the 2, 3, 4, 5, B, D, N, Q and R stop.",
        },
      ],
    },
  },
  {
    slug: 'how-to-pick-a-date-spot',
    title: 'How to pick a date spot you can both reach',
    description:
      'Pick a date spot that is easy for both of you to reach, plan the trip home as well as the trip there, and keep a backup nearby.',
    publishedAt: '2026-10-08',
    updatedAt: '2026-10-08',
    occasion: 'date-night',
    coverAlt:
      "Grand Central Terminal's main concourse under its painted ceiling, next to the article title.",
    coverPhoto: {
      place: 'Grand Central Terminal',
      author: 'D. Benjamin Miller',
      license: 'CC0',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Main_Concourse,_Grand_Central_Terminal,_August_30,_2024_-_001.jpg',
    },
    examplePlaces: {
      title: 'Date spots near the subway in New York',
      places: [
        {
          placeId: 'ChIJvQwwiQFZwokRQDZSQpZrTrk',
          label: 'The Campbell',
          note: 'A cocktail bar inside Grand Central. The 4, 5, 6, 7 and S trains and Metro-North all leave from the same building.',
        },
        {
          placeId: 'ChIJbfTV15NZwokRSeNM676BEZI',
          label: 'Blue Note',
          note: "A jazz club, for a date built around a show. It's about a 1-minute walk from the West 4th St station, where the A, B, C, D, E, F and M stop.",
        },
        {
          placeId: 'ChIJIQntspT8ZUARP3MLeK4a1vA',
          label: "Pete's Tavern",
          note: "A restaurant and bar on Irving Place. It's about a 5-minute walk from the Union Square station, where the 4, 5, 6, L, N, Q, R and W stop.",
        },
      ],
    },
  },
  {
    slug: 'how-to-plan-a-weekend-hangout-with-friends',
    title: 'How to plan a weekend hangout with friends',
    description:
      'Your friends live all over town and the group chat never lands on a plan. Pick an activity, find a spot everyone can reach, and lock it in before Friday.',
    publishedAt: '2026-10-05',
    updatedAt: '2026-10-08',
    occasion: 'weekend-hangout',
    coverAlt:
      "Bryant Park's lawn and chairs, with the Empire State Building behind them, next to the article title.",
    coverPhoto: {
      place: 'Bryant Park',
      author: 'Phi',
      license: 'CC0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bryant_Park_%26_Emp_State.JPG',
    },
    examplePlaces: {
      title: 'Weekend spots near the subway in New York',
      places: [
        {
          placeId: 'ChIJw2lMFL9ZwokRosAtly52YX4',
          label: 'Chelsea Market',
          note: "A food hall in Chelsea, where everyone can order what they want. It's about a 5-minute walk from the 14th St and 8th Ave station, where the A, C, E and L stop.",
        },
        {
          placeId: 'ChIJvbGg56pZwokRp_E3JbivnLQ',
          label: 'Bryant Park',
          note: 'A Midtown park with tables and movable chairs, so people can join late or leave early. The Bryant Park station, where the B, D, F and M stop, is at its corner.',
        },
        {
          placeId: 'ChIJUf2r9FRYwokRKrasyV7rvwQ',
          label: 'Lucky Strike Times Square',
          note: 'Bowling lanes about a 3-minute walk from the Times Square station, where the 1, 2, 3, 7, N, Q, R, W and S stop. Ask about booking lanes for your group.',
        },
      ],
    },
  },
  {
    slug: 'how-to-choose-a-team-meeting-location',
    title: 'How to choose a team meeting location',
    description:
      'Your team is spread across town. Compare travel times, pick a venue that suits the meeting, and settle on a place without a week of back-and-forth.',
    publishedAt: '2026-10-04',
    updatedAt: '2026-10-08',
    occasion: 'team-meeting',
    coverAlt:
      "Herald Square's plaza and memorial clock in Midtown Manhattan, next to the article title.",
    coverPhoto: {
      place: 'Herald Square',
      author: 'Ypsilonatshared',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Herald_Square_wts.jpg',
    },
    examplePlaces: {
      title: 'Meeting spots near the subway in New York',
      places: [
        {
          placeId: 'ChIJC4bmgFVYwokRu5RK8aA7ikY',
          label: 'Convene, West 46th St',
          note: "A meeting and event space you can book for a working session. It's about a 1-minute walk from the Rockefeller Center station, where the B, D, F and M stop.",
        },
        {
          placeId: 'ChIJix_4sahZwokRRjUrKamamvo',
          label: 'Nomadworks, Broadway',
          note: 'A coworking space about a 3-minute walk from the Herald Square station, where the B, D, F, M, N, Q, R and W stop. Ask about day passes and meeting rooms before you go.',
        },
        {
          placeId: 'ChIJuYpnQk1awokRJZlTgJL7mqg',
          label: 'Bacchus',
          note: "A French restaurant in Brooklyn for a team lunch. Google lists it as taking reservations and good for groups. It's about a 3-minute walk from the Hoyt-Schermerhorn station, where the A, C and G stop.",
        },
      ],
    },
  },
];

/** Newest first. Dates are checked at module load so a typo fails the build. */
export const BLOG_POSTS: readonly BlogPost[] = posts
  .map((post) => ({
    ...post,
    publishedAt: assertIsoDate(post.publishedAt, `${post.slug}.publishedAt`),
    updatedAt: assertIsoDate(post.updatedAt, `${post.slug}.updatedAt`),
  }))
  .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

export function postPath(slug: string) {
  return `/blog/${slug}`;
}

export function coverPath(slug: string) {
  return `${postPath(slug)}/cover.png`;
}

/** Relative to the client root, where the cover renderer reads it. */
export function coverPhotoFile(slug: string) {
  return `src/content/blog/covers/${slug}.jpg`;
}
