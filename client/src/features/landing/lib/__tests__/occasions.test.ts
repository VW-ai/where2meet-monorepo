import { describe, expect, it } from 'vitest';
import { fixtureContent } from '@/features/blog/__fixtures__/content-files';
import { parseCatalog } from '@/features/blog/lib/parse';
import { HOME_OCCASIONS } from '../occasions';

describe('HOME_OCCASIONS', () => {
  it('keys every chip by an occasion in taxonomy.yaml, so the homepage guides can match its posts', () => {
    const { occasions } = parseCatalog(fixtureContent()).catalog.taxonomy;
    const taxonomyLabel = (key: string) =>
      occasions.find((occasion) => occasion.key === key)?.label;

    expect(HOME_OCCASIONS.map(({ key }) => taxonomyLabel(key))).toEqual([
      'Date night',
      'Team meeting',
      'Group dinner',
      'Coffee catch-up',
      'Weekend hangout',
      'Family outing',
    ]);
  });
});
