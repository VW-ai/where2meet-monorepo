/** CC BY asks us to credit the author, link the license and say when we cropped the photo. */
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

export interface PhotoCredit {
  author: string;
  license: License;
  pageUrl: string;
  cropped: boolean;
}

export interface Photo {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
  credit: PhotoCredit;
}

export interface CommonsImage extends Photo {
  fileName: string;
  sourceUrl: string;
}

export function showsCrop({ license, cropped }: PhotoCredit): boolean {
  return cropped && LICENSES[license].attribution;
}
