import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import fixture from '../../__fixtures__/published.json';
import { findPage } from '../../lib/catalog';
import { parsePublished } from '../../lib/parse';
import { GuidesPageView } from '../guides-page';

const ORIGIN = 'https://www.where2meet.org';
const { catalog } = parsePublished(fixture);

function render(...segments: string[]) {
  const page = findPage(catalog, segments);
  if (!page) throw new Error(`Nothing is published at ${segments.join('/')}`);
  return renderToStaticMarkup(<GuidesPageView page={page} />).replace(/ class="[^"]*"/g, '');
}

function section(html: string, heading: string) {
  return html.match(new RegExp(`<section><h2>${heading}</h2>(.*?)</section>`, 's'))?.[1] ?? '';
}

function outline(html: string) {
  return [...html.matchAll(/<h3>(.*?)<\/h3>|<a href="([^"]+)">(.*?)<\/a>/gs)].map(
    ([, heading, href, body]) => {
      if (heading !== undefined) return `### ${heading.replace(/<[^>]+>/g, '')}`;
      const chips = [...body.matchAll(/<li>(.*?)<\/li>/g)].map(([, label]) => label);
      return chips.length > 0 ? `${href} [${chips.join(' | ')}]` : href;
    }
  );
}

function structuredData(html: string) {
  return [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(
    ([, json]) => JSON.parse(json)
  );
}

describe('local guide pages', () => {
  it('groups a town hub by occasion and links the blog post for an occasion that has one', () => {
    const html = render('new-york', 'midtown');
    expect(outline(section(html, 'Guides for Midtown'))).toEqual([
      '### Team meeting',
      '/blog/how-to-choose-a-team-meeting-location',
      '/where-to-meet/new-york/midtown/quiet-places-for-a-small-team-meeting [Weekday lunch | Small group, 3 to 6 | Inexpensive]',
      '/where-to-meet/new-york/midtown/bookable-rooms-for-a-big-team-meeting [Big group, 7 or more | Mid-range]',
      '### Team welcome',
      '/where-to-meet/new-york/midtown/a-team-welcome-lunch-in-bryant-park [Weekday lunch | Park | Big group, 7 or more]',
    ]);
    expect(html).toContain(
      '<p>From the blog: <a href="/blog/how-to-choose-a-team-meeting-location">How to choose a team meeting location everyone can reach</a></p>'
    );
  });

  it('lists a city hub’s own guides by occasion, then its towns', () => {
    const html = render('new-york');
    expect(outline(section(html, 'Guides for New York'))).toEqual([
      '### Coffee catch-up',
      '/where-to-meet/new-york/coffee-shops-for-a-catch-up-near-union-square [Coffee shop | Two people | Inexpensive]',
      '### Weekend hangout',
      '/blog/how-to-plan-a-weekend-hangout-with-friends',
      '/where-to-meet/new-york/a-weekend-afternoon-in-bryant-park-with-friends [Weekend afternoon | Park | Small group, 3 to 6 | Inexpensive]',
    ]);
    expect(outline(section(html, 'Neighborhoods and towns'))).toEqual([
      '/where-to-meet/new-york/midtown',
    ]);
  });

  it('shows a guide’s occasion and parameters under its title and links every other guide in its area', () => {
    const html = render('new-york', 'midtown', 'quiet-places-for-a-small-team-meeting');
    expect(html).toContain(
      '<h1>Quiet places for a small team meeting in Midtown</h1><ul><li>Team meeting</li><li>Weekday lunch</li><li>Small group, 3 to 6</li><li>Inexpensive</li></ul>'
    );
    expect(html).toContain('<h2>Plan your team meeting on Where2Meet</h2>');
    expect(outline(section(html, 'More guides for Midtown'))).toEqual([
      '/where-to-meet/new-york/midtown/bookable-rooms-for-a-big-team-meeting [Team meeting | Big group, 7 or more | Mid-range]',
      '/where-to-meet/new-york/midtown/a-team-welcome-lunch-in-bryant-park [Team welcome | Weekday lunch | Park | Big group, 7 or more]',
      '/where-to-meet/new-york/midtown',
    ]);
  });

  it('names a guide by its title in the breadcrumbs and points its BlogPosting at its slug URL', () => {
    const [breadcrumbs, posting] = structuredData(
      render('new-york', 'midtown', 'quiet-places-for-a-small-team-meeting')
    );
    expect(
      breadcrumbs.itemListElement.map(({ name, item }: { name: string; item: string }) => [
        name,
        item,
      ])
    ).toEqual([
      ['Home', `${ORIGIN}/`],
      ['Where to meet', `${ORIGIN}/where-to-meet`],
      ['New York', `${ORIGIN}/where-to-meet/new-york`],
      ['Midtown', `${ORIGIN}/where-to-meet/new-york/midtown`],
      [
        'Quiet places for a small team meeting in Midtown',
        `${ORIGIN}/where-to-meet/new-york/midtown/quiet-places-for-a-small-team-meeting`,
      ],
    ]);
    expect(posting.mainEntityOfPage).toEqual({
      '@type': 'WebPage',
      '@id': `${ORIGIN}/where-to-meet/new-york/midtown/quiet-places-for-a-small-team-meeting`,
    });
  });
});
