import { describe, expect, it } from 'vitest';
import { coverCredit, type Photo } from '../photos';

function photo(author: string, license: Photo['credit']['license']): Photo {
  return {
    src: '/blog/images/a.jpg',
    width: 1280,
    height: 960,
    alt: 'A street',
    caption: 'A street',
    credit: {
      author,
      license,
      pageUrl: 'https://commons.wikimedia.org/wiki/File:A.jpg',
      cropped: false,
    },
  };
}

describe('coverCredit', () => {
  it('says a CC BY photo is cropped, because the cover always crops it', () => {
    expect(coverCredit(photo('Jazz Guy', 'CC BY 2.0'))).toBe('Jazz Guy, CC BY 2.0, cropped');
    expect(coverCredit(photo('Jakub Hałun', 'CC BY 4.0'))).toBe('Jakub Hałun, CC BY 4.0, cropped');
  });

  it('leaves CC0 and public-domain credits as they are', () => {
    expect(coverCredit(photo('Phi', 'CC0'))).toBe('Phi, CC0');
    expect(coverCredit(photo('Ypsilonatshared', 'Public domain'))).toBe(
      'Ypsilonatshared, Public domain'
    );
  });
});
