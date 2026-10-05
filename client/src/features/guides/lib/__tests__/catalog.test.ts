import { describe, expect, it } from 'vitest';
import fixture from '../../__fixtures__/published.json';
import { findPage, latestUpdate, listPages, pagePath, pageTrail } from '../catalog';
import { parsePublished } from '../parse';

const { catalog } = parsePublished(fixture);

describe('guides catalog', () => {
  it('lists each city, its guides, then each town and its guides', () => {
    expect(listPages(catalog).map(pagePath)).toEqual([
      '/where-to-meet/new-york',
      '/where-to-meet/new-york/team-meeting',
      '/where-to-meet/new-york/coffee-catch-up',
      '/where-to-meet/new-york/williamsburg',
      '/where-to-meet/new-york/williamsburg/date-night',
      '/where-to-meet/new-york/williamsburg/weekend-hangout',
      '/where-to-meet/ann-arbor',
      '/where-to-meet/ann-arbor/group-dinner',
      '/where-to-meet/ann-arbor/coffee-catch-up',
      '/where-to-meet/ann-arbor/kerrytown',
      '/where-to-meet/ann-arbor/kerrytown/weekend-hangout',
    ]);
  });

  it('tells a city guide from a town hub by the second segment', () => {
    const guide = findPage(catalog, ['new-york', 'team-meeting']);
    const hub = findPage(catalog, ['new-york', 'williamsburg']);

    expect(guide?.kind === 'guide' && guide.guide.seo.title).toBe(
      'Where to hold a team meeting in New York'
    );
    expect(hub?.kind === 'hub' && hub.town?.name).toBe('Williamsburg');
  });

  it('finds nothing that is not published', () => {
    expect(findPage(catalog, ['boston'])).toBeNull();
    expect(findPage(catalog, ['new-york', 'date-night'])).toBeNull();
    expect(findPage(catalog, ['new-york', 'williamsburg', 'team-meeting'])).toBeNull();
    expect(findPage(catalog, ['ann-arbor', 'williamsburg'])).toBeNull();
  });

  it('builds breadcrumbs from the index down to a town guide', () => {
    const page = findPage(catalog, ['new-york', 'williamsburg', 'date-night']);
    expect(page && pageTrail(page)).toEqual([
      { name: 'Where to meet', path: '/where-to-meet' },
      { name: 'New York', path: '/where-to-meet/new-york' },
      { name: 'Williamsburg', path: '/where-to-meet/new-york/williamsburg' },
      { name: 'Date night', path: '/where-to-meet/new-york/williamsburg/date-night' },
    ]);
  });

  it('dates the catalog by its newest page', () => {
    expect(latestUpdate(catalog)).toBe('2026-10-05');
    expect(latestUpdate({ cities: [] })).toBeNull();
  });
});
