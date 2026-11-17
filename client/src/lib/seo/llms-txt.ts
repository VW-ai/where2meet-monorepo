import { SITE_CONFIG, toAbsoluteUrl } from '@/lib/seo/metadata';
import {
  pagePath,
  postPath,
  type AreaPage,
  type Catalog,
  type Post,
} from '@/features/blog/lib/catalog';

const INTRO = `# Where2Meet

> Where2Meet is a free web app where a group plans where to meet together. Everyone adds where they are starting from, the group looks for places near everyone, compares each person's real travel time to a place by car, transit, walking or bike, and votes on a convenient spot. No account is needed to create a meeting or join one from a shared link.

Where2Meet (www.where2meet.org) is not affiliated with When2meet, the availability-poll scheduling tool. Where2Meet answers "where should we meet?", not "when are we all free?".

Common uses: dinner with friends from different neighborhoods, a date somewhere convenient for both people, team meetings or lunch with coworkers from different offices, weekend hangouts, family get-togethers, and team offsites.

How it works:

1. Create a meeting with a title, a time and your name. Adding where you are coming from is optional.
2. Share the link. Each person adds their own starting point, which can be a nearby cross street, station or neighborhood instead of a home address.
3. Search for places such as cafes or restaurants around the group, or add a specific place by name.
4. Select a place to see every person's travel time and route on the map, then like the places you would go to.
5. The organizer picks the final place from the group's shortlist.

Contact: email ${SITE_CONFIG.email}. The team replies within a couple of days.

## Pages

- [Home](https://www.where2meet.org/): Create a meeting and see how planning works.
- [FAQ](https://www.where2meet.org/faq): How group planning works, accounts, choosing a starting point, travel modes, voting and cost.
- [Blog](https://www.where2meet.org/blog): Guides to planning where to meet with friends, family and coworkers.
- [About](https://www.where2meet.org/about): What Where2Meet is, why it exists and who makes it.
- [Contact](https://www.where2meet.org/contact): How to reach the Where2Meet team.
- [Privacy](https://www.where2meet.org/privacy): What Where2Meet collects when you plan a meeting, who can see it, which services process it, and how to delete it.
`;

const OPTIONAL = `
## Optional

- [Sitemap](https://www.where2meet.org/sitemap.xml): Machine-readable list of public pages with last-modified dates.
`;

export function buildLlmsTxt(catalog: Catalog): string {
  const sections = [...catalog.cities.values()].map((city) =>
    section(city.name, [
      areaLink({ kind: 'area', city, town: null }),
      ...[...city.towns.values()].map((town) => areaLink({ kind: 'area', city, town })),
      ...catalog.posts.filter((post) => post.areas[0]?.slug === city.slug).map(postLink),
    ])
  );
  const noCity = catalog.posts.filter((post) => post.areas.length === 0);
  if (noCity.length > 0) sections.push(section('More guides', noCity.map(postLink)));
  return `${INTRO}${sections.join('')}${OPTIONAL}`;
}

function section(heading: string, links: string[]) {
  return `\n## ${heading}\n\n${links.join('\n')}\n`;
}

function areaLink(page: AreaPage) {
  const { seo } = page.town ?? page.city;
  return link(seo.title, pagePath(page), seo.description);
}

function postLink(post: Post) {
  return link(post.title, postPath(post), post.description);
}

function link(title: string, path: string, description: string) {
  const linkText = oneLine(title).replace(/[[\]]/g, '\\$&');
  return `- [${linkText}](${toAbsoluteUrl(path)}): ${oneLine(description)}`;
}

function oneLine(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}
