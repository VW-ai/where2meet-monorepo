import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { REPO_POSTS } from '@/content/blog/posts';
import fixture from '../../__fixtures__/published.json';
import { findPage, withRepoPosts } from '../../lib/catalog';
import { parsePublished } from '../../lib/parse';
import { BlogPageView } from '../blog-page';

const ORIGIN = 'https://www.where2meet.org';
const catalog = withRepoPosts(
  REPO_POSTS,
  parsePublished(
    fixture,
    REPO_POSTS.map(({ slug }) => slug)
  ).catalog
);

function render(path: string) {
  const page = findPage(catalog, path.split('/'));
  if (!page) throw new Error(`Nothing is published at /blog/${path}`);
  return renderToStaticMarkup(<BlogPageView page={page} catalog={catalog} />)
    .replace(/ class="[^"]*"/g, '')
    .replace(/ (srcSet|sizes|decoding|style|data-nimg)="[^"]*"/g, '')
    .replaceAll('&amp;', '&')
    .replaceAll('&#x27;', "'");
}

/** The article's headings, figures and place-card sections in order, as short lines. */
function outline(html: string) {
  const article = html.match(/<article>(.*)<\/article>/s)?.[1] ?? '';
  return [
    ...article.matchAll(
      /<h([12])>(.*?)<\/h\1>|<figure><img alt="([^"]*)"[^>]*?src="([^"]+)"[^>]*\/><figcaption>(.*?)<\/figcaption><\/figure>|<section aria-labelledby="[^"]+"><h2 id="[^"]+">(.*?)<\/h2>/gs
    ),
  ].map(([, level, heading, alt, src, caption, places]) => {
    if (heading !== undefined) return `h${level} ${heading}`;
    if (places !== undefined) return `places: ${places}`;
    return `figure ${decodeURIComponent(src)} "${alt}" | ${caption.replace(/<[^>]+>/g, '')}`;
  });
}

function links(html: string, heading: string) {
  const section = html.match(new RegExp(`<section><h2>${heading}</h2>(.*?)</section>`, 's'))?.[1];
  return [...(section ?? '').matchAll(/<a href="([^"]+)">/g)].map(([, href]) => href);
}

function structuredData(html: string) {
  return [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(
    ([, json]) => JSON.parse(json)
  );
}

describe('BlogPageView', () => {
  it('renders a town post with chips, both dates, its cover and its photos and places in the body', () => {
    const html = render('new-york/midtown/quiet-places-for-a-small-team-meeting');

    expect(html).toContain(
      '<h1>Quiet places for a small team meeting in Midtown</h1><ul><li>Team meeting</li><li>Weekday lunch</li><li>Small group, 3 to 6</li><li>Inexpensive</li></ul>'
    );
    expect(html).toContain(
      '<p>The Where2Meet team · Published <time dateTime="2026-10-05">October 5, 2026</time> · Updated <time dateTime="2026-10-07">October 7, 2026</time></p>'
    );
    expect(outline(html)).toEqual([
      'h1 Quiet places for a small team meeting in Midtown',
      'figure /_next/image?url=/blog/images/new-york-public-library-lion-midtown.jpg&w=3840&q=75 "The stone lion outside the New York Public Library\'s main branch" | The library\'s stone lion on Fifth Avenue. Photo by John Dillenbeck (CC0) via Wikimedia Commons',
      'h2 Where can a small team meet quietly in Midtown?',
      'figure /_next/image?url=/blog/images/bryant-park-from-one-vanderbilt.jpg&w=3840&q=75 "Bryant Park and the library seen from the top of One Vanderbilt" | Bryant Park from above. Photo by Larry D. Moore (CC BY 4.0, cropped) via Wikimedia Commons',
      'h2 Which places take bookings?',
      'places: Our picks in Midtown',
      'h2 When is Midtown quietest?',
      'figure /_next/image?url=/blog/images/grand-central-concourse-windows.jpg&w=3840&q=75 "Light through the tall windows of Grand Central\'s main concourse" | Grand Central\'s main concourse at midday. Photo by Warren LeMay (CC0) via Wikimedia Commons',
      'h2 How to do it in Where2Meet',
      'h2 Common questions',
    ]);
    expect(html).toContain(
      'Photo by Larry D. Moore (<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>, cropped) via <a href="https://commons.wikimedia.org/wiki/File:Bryant_Park_from_One_Vanderbilt_New_York_City_2022.jpg">Wikimedia Commons</a>'
    );
    expect(html).toContain('<h2>Plan your team meeting on Where2Meet</h2>');
    expect(links(html, 'More from the blog')).toEqual([
      '/blog/how-to-choose-a-team-meeting-location',
      '/blog/new-york/midtown/a-team-welcome-lunch-in-bryant-park',
      '/blog/new-york/group-dinner-spots-near-herald-square',
      '/blog/how-to-pick-a-restaurant-for-a-group-dinner',
    ]);
  });

  it('loads a post’s cover eagerly and every body photo lazily', () => {
    const html = render('new-york/midtown/quiet-places-for-a-small-team-meeting');
    expect(
      [...html.matchAll(/<img alt="[^"]*" loading="(\w+)" width="(\d+)" height="(\d+)"/g)].map(
        ([, loading, width, height]) => `${loading} ${width}x${height}`
      )
    ).toEqual(['eager 1280x960', 'lazy 1280x853', 'lazy 1280x960']);
  });

  it('puts a general post’s unplaced photos and place cards after its second section, without chips', () => {
    const html = render('how-to-plan-a-team-welcome-lunch');
    expect(html).not.toContain('<h1>How to plan a team welcome lunch</h1><ul>');
    expect(outline(html).map((line) => line.split(' | ')[0])).toEqual([
      'h1 How to plan a team welcome lunch',
      'figure /_next/image?url=/blog/images/grand-central-main-concourse-new-york.jpg&w=3840&q=75 "Grand Central Terminal\'s main concourse with its clock and ticket windows"',
      'h2 Where should a team welcome lunch be?',
      'h2 How far ahead should you book a team welcome lunch?',
      'figure /_next/image?url=/blog/images/rockefeller-center-concourse.jpg&w=3840&q=75 "The underground concourse at Rockefeller Center with shops on both sides"',
      'figure /_next/image?url=/blog/images/rockefeller-center-lights-at-sunset.jpg&w=3840&q=75 "Rockefeller Center\'s towers lit up at sunset"',
      'places: Our picks',
      'h2 How long should the lunch take?',
      'h2 How to do it in Where2Meet',
      'h2 Common questions',
      'h2 A quick checklist',
    ]);
  });

  it('lists a BlogPosting’s photos and breadcrumbs from Home down to a town post', () => {
    const [breadcrumbs, posting] = structuredData(
      render('new-york/midtown/a-team-welcome-lunch-in-bryant-park')
    );
    expect(
      breadcrumbs.itemListElement.map(({ name, item }: { name: string; item: string }) => [
        name,
        item,
      ])
    ).toEqual([
      ['Home', `${ORIGIN}/`],
      ['Blog', `${ORIGIN}/blog`],
      ['New York', `${ORIGIN}/blog/new-york`],
      ['Midtown', `${ORIGIN}/blog/new-york/midtown`],
      [
        'A team welcome lunch in Bryant Park',
        `${ORIGIN}/blog/new-york/midtown/a-team-welcome-lunch-in-bryant-park`,
      ],
    ]);
    expect(posting.image.map(({ contentUrl }: { contentUrl: string }) => contentUrl)).toEqual([
      `${ORIGIN}/blog/images/bryant-park-carousel-midtown.jpg`,
      `${ORIGIN}/blog/images/midtown-view-from-empire-state-building.jpg`,
      `${ORIGIN}/blog/images/seventh-avenue-times-square-north.jpg`,
    ]);
  });

  it('renders a city with its photo, intro, transit notes, posts and towns', () => {
    const html = render('new-york');
    expect(outline(html.replace(/^.*?<h1>/s, '<article><h1>') + '</article>')).toEqual(
      expect.arrayContaining([
        'h1 Where to meet in New York',
        'figure /_next/image?url=/blog/images/midtown-manhattan-skyline-new-york.jpg&w=3840&q=75 "The Midtown Manhattan skyline with the Empire State Building" | The Midtown Manhattan skyline. Photo by CommunistSquared (CC0) via Wikimedia Commons',
      ])
    );
    expect(html).toContain('<h2>Getting around</h2>');
    expect(links(html, 'Guides for New York')).toEqual([
      '/blog/new-york/midtown/a-team-welcome-lunch-in-bryant-park',
      '/blog/new-york/group-dinner-spots-near-herald-square',
      '/blog/new-york/midtown/quiet-places-for-a-small-team-meeting',
    ]);
    expect(links(html, 'Neighborhoods and towns')).toEqual(['/blog/new-york/midtown']);
    expect(html).toContain('<h2>Plan where to meet in New York</h2>');
  });

  it('shows a repo post’s cover card and credit in the same template', () => {
    const html = render('how-to-choose-a-team-meeting-location');
    expect(outline(html)).toEqual([
      'h1 How to choose a team meeting location',
      'figure /_next/image?url=/blog/how-to-choose-a-team-meeting-location/cover.png&w=3840&q=75 "Herald Square\'s plaza and memorial clock in Midtown Manhattan, next to the article title." | Herald Square. Photo by Ypsilonatshared (Public domain) via Wikimedia Commons',
    ]);
    expect(html).toContain('<h2>Plan your team meeting on Where2Meet</h2>');
  });
});
