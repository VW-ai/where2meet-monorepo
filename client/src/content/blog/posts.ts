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
