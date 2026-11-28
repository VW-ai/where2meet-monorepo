import type { ItemList, WithContext } from 'schema-dts';
import { SITE_CONFIG } from '@/lib/seo/metadata';
import { mapsUrl, themePath, type LiveTheme } from '../model/themes';

/** The theme's places as a list search engines read, each linked to its Google Maps page. */
export function themeItemList(theme: LiveTheme): WithContext<ItemList> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: theme.title,
    description: theme.description,
    url: `${SITE_CONFIG.url}${themePath(theme)}`,
    numberOfItems: theme.places.length,
    itemListElement: theme.places.map((place, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Place',
        name: place.label,
        description: place.note,
        hasMap: mapsUrl(place),
      },
    })),
  };
}
