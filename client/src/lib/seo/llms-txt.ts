import { toAbsoluteUrl } from '@/lib/seo/metadata';
import {
  GUIDES_PATH,
  listPages,
  pageEntry,
  pagePath,
  type Catalog,
} from '@/features/guides/lib/catalog';

/** Edit by hand when a page or post is added; a test fails if a post is missing. */
const SITE = `# Where2Meet

> Where2Meet is a free web app where a group plans where to meet together. Everyone adds where they are starting from, the group looks for places near everyone, compares each person's real travel time to a place by car, transit, walking or bike, and votes on a convenient spot. No account is needed to create a meeting or join one from a shared link.

Where2Meet (www.where2meet.org) is not affiliated with When2Meet, the availability-poll scheduling tool. Where2Meet answers "where should we meet?", not "when are we all free?".

Common uses: dinner with friends from different neighborhoods, a date with balanced travel for both people, team meetings or lunch with coworkers from different offices, weekend hangouts, family get-togethers, and team offsites.

How it works:

1. Create a meeting with a title, a time, your name and where you are coming from.
2. Share the link. Each person adds their own starting point, optionally as an approximate area instead of an exact address.
3. Search for places such as cafes or restaurants around the group, or add a specific place by name.
4. Select a place to see every person's travel time and route on the map, then like the places you would go to.
5. The organizer picks the final place from the group's shortlist.

## Pages

- [Home](https://www.where2meet.org/): Create a meeting and see how planning works.
- [FAQ](https://www.where2meet.org/faq): How group planning works, accounts, hiding your exact address, travel modes, voting and cost.
- [Blog](https://www.where2meet.org/blog): Guides to planning where to meet with friends, family and coworkers.
- [How to plan a weekend hangout with friends across town](https://www.where2meet.org/blog/how-to-plan-a-weekend-hangout-with-friends): Pick an activity, find a spot everyone can reach, and lock in the plan before Friday.
- [How to choose a team meeting location everyone can reach](https://www.where2meet.org/blog/how-to-choose-a-team-meeting-location): Compare travel times, pick a venue that suits the meeting, and settle on a place without a week of back-and-forth.
- [Contact](https://www.where2meet.org/contact): How to reach the Where2Meet team.
`;

const OPTIONAL = `
## Optional

- [Sitemap](https://www.where2meet.org/sitemap.xml): Machine-readable list of public pages with last-modified dates.
`;

/**
 * The /llms.txt summary for AI assistants: the site and its pages, then every
 * published local guide when there are any.
 */
export function buildLlmsTxt(catalog: Catalog): string {
  const pages = listPages(catalog);
  if (pages.length === 0) return SITE + OPTIONAL;
  const links = [
    link('Where to meet', GUIDES_PATH, 'Local guides by city to places that work for groups.'),
    ...pages.map((page) => {
      const { seo } = pageEntry(page);
      return link(seo.title, pagePath(page), seo.description);
    }),
  ];
  return `${SITE}\n## Local guides\n\n${links.join('\n')}\n${OPTIONAL}`;
}

/** One list line. Line breaks and brackets in control plane copy can't break the list or link. */
function link(title: string, path: string, description: string) {
  const linkText = oneLine(title).replace(/[[\]]/g, '\\$&');
  return `- [${linkText}](${toAbsoluteUrl(path)}): ${oneLine(description)}`;
}

function oneLine(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}
