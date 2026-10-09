/**
 * The licenses a post's photo may carry. CC BY asks us to credit the author, link the
 * license and say when we cropped the photo. Share-alike licenses are left out on purpose.
 */
export const LICENSES = {
  CC0: { url: 'https://creativecommons.org/publicdomain/zero/1.0/', attribution: false },
  'Public domain': { url: null, attribution: false },
  'CC BY 2.0': { url: 'https://creativecommons.org/licenses/by/2.0/', attribution: true },
  'CC BY 3.0': { url: 'https://creativecommons.org/licenses/by/3.0/', attribution: true },
  'CC BY 4.0': { url: 'https://creativecommons.org/licenses/by/4.0/', attribution: true },
} as const satisfies Record<string, { url: string | null; attribution: boolean }>;

export type License = keyof typeof LICENSES;

export function isLicense(value: unknown): value is License {
  return typeof value === 'string' && Object.hasOwn(LICENSES, value);
}

/** Who took a Wikimedia Commons photo, and the license we show it under. */
export interface PhotoCredit {
  author: string;
  license: License;
  /** The photo's Commons page, which states its license. */
  pageUrl: string;
  cropped: boolean;
}

/** A photo a page shows from this site's own `src`. */
export interface Photo {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
  credit: PhotoCredit;
}

/** A Commons photo picked in the panel, served at `/blog/images/<fileName>` from `sourceUrl`. */
export interface CommonsImage extends Photo {
  fileName: string;
  sourceUrl: string;
}

/** Whether the caption says "cropped": only CC BY asks for it. */
export function showsCrop({ license, cropped }: PhotoCredit): boolean {
  return cropped && LICENSES[license].attribution;
}
