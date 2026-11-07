import { describe, expect, it } from 'vitest';
import type { Venue } from '@/entities/venue/types';
import {
  SEARCH_MOVE_HANDLE,
  SEARCH_SIZE_HANDLE,
  personPinImage,
  personPinLabel,
  personPinLook,
  personPinZIndex,
  placeRouteChips,
  routeChipImage,
  routeChipLabel,
  searchHandleBearings,
  tripLabel,
  truncatePinName,
  venuePinImage,
  venuePinLook,
  venuePinZIndex,
  venuesOnMap,
  type PinImage,
} from '../map-pins';

const svgOf = (image: PinImage) => decodeURIComponent(image.url);

const textsOf = (image: PinImage) =>
  [...svgOf(image).matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(([, text]) => text);

const CAFE = { types: ['cafe'], name: 'Blue Bottle' };
const NOTHING = {
  likes: 0,
  isSaved: false,
  isSelected: false,
  isHovered: false,
  isPublished: false,
};

function venue(id: string, overrides: Partial<Venue> = {}): Venue {
  return { id, name: id, location: { lat: 1, lng: 2 }, types: [], ...overrides } as Venue;
}

describe('venuePinLook', () => {
  it('leaves an unliked venue plain, with no name', () => {
    expect(venuePinLook(CAFE, NOTHING)).toEqual({ category: 'cafe', likes: 0, emphasis: 'plain' });
  });

  it('highlights a venue anyone liked, with the live count', () => {
    expect(venuePinLook(CAFE, { ...NOTHING, likes: 3 })).toMatchObject({
      emphasis: 'liked',
      likes: 3,
    });
    expect(venuePinLook(CAFE, { ...NOTHING, isSaved: true }).emphasis).toBe('liked');
  });

  it('ranks published over selected over hovered over liked, and names those above liked', () => {
    const all = { likes: 2, isSaved: true, isSelected: true, isHovered: true, isPublished: true };
    expect(venuePinLook(CAFE, all)).toMatchObject({ emphasis: 'published', name: 'Blue Bottle' });
    expect(venuePinLook(CAFE, { ...all, isPublished: false }).emphasis).toBe('selected');
    expect(venuePinLook(CAFE, { ...all, isPublished: false, isSelected: false })).toMatchObject({
      emphasis: 'hovered',
      name: 'Blue Bottle',
    });
    expect(venuePinLook(CAFE, { ...NOTHING, likes: 2 }).name).toBeUndefined();
  });

  it('falls back to things to do for an unknown type', () => {
    expect(venuePinLook({ types: ['nope'], name: 'x' }, NOTHING).category).toBe('things_to_do');
  });
});

describe('truncatePinName', () => {
  it('keeps a short name whole', () => {
    expect(truncatePinName('  Blue Bottle ')).toBe('Blue Bottle');
    expect(truncatePinName('a'.repeat(24))).toBe('a'.repeat(24));
  });

  it('ends a long name in an ellipsis at 24 characters', () => {
    const cut = truncatePinName('a'.repeat(40));
    expect(Array.from(cut)).toHaveLength(24);
    expect(cut.endsWith('…')).toBe(true);
  });

  it('never splits a character outside the basic plane', () => {
    const cut = truncatePinName('😀'.repeat(40));
    expect(cut).toBe(`${'😀'.repeat(23)}…`);
    expect(() => encodeURIComponent(cut)).not.toThrow();
  });
});

describe('venuePinImage', () => {
  const look = (state: Partial<typeof NOTHING>, name = CAFE.name) =>
    venuePinLook({ ...CAFE, name }, { ...NOTHING, ...state });

  it('escapes a name that would otherwise be markup', () => {
    const image = venuePinImage(look({ isSelected: true }, `<b>"T" & 'J'</b>`));
    expect(svgOf(image)).not.toContain('<b>');
    expect(textsOf(image)).toEqual(['&lt;b&gt;&quot;T&quot; &amp; &#39;J&#39;&lt;/b&gt;']);
  });

  it('drops characters XML cannot hold, rather than breaking the image', () => {
    const image = venuePinImage(look({ isSelected: true }, 'Caf\u0001e\ud83d'));
    expect(textsOf(image)).toEqual(['Cafe']);
  });

  it('shows the count in a badge only when someone liked it', () => {
    expect(textsOf(venuePinImage(look({ likes: 12 })))).toEqual(['12']);
    expect(textsOf(venuePinImage(look({})))).toEqual([]);
    expect(textsOf(venuePinImage(look({ isSelected: true })))).toEqual(['Blue Bottle']);
    expect(textsOf(venuePinImage(look({ isSelected: true, likes: 2 })))).toEqual([
      '2',
      'Blue Bottle',
    ]);
  });

  it('grows from plain to liked to selected to published', () => {
    const radius = (state: Partial<typeof NOTHING>) => venuePinImage(look(state)).hit.radius;
    const sizes = [
      radius({}),
      radius({ likes: 1 }),
      radius({ isSelected: true }),
      radius({ isPublished: true }),
    ];
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
    expect(new Set(sizes).size).toBe(4);
  });

  it('keeps the anchor on the dot however long the name is, with room for the label', () => {
    const short = venuePinImage(look({ isSelected: true }, 'Ab'));
    const long = venuePinImage(look({ isSelected: true }, '世'.repeat(24)));
    expect(long.width).toBeGreaterThanOrEqual(24 * 12);
    expect(long.anchorX).toBe(long.width / 2);
    expect(long.anchorX).toBe(long.hit.x);
    expect(long.anchorY).toBe(short.anchorY);
  });

  it('gives the same look the same image object, so nothing is redrawn', () => {
    expect(venuePinImage(look({ likes: 2 }))).toBe(venuePinImage(look({ likes: 2 })));
    expect(venuePinImage(look({ likes: 2 }))).not.toBe(venuePinImage(look({ likes: 3 })));
  });

  it('draws at twice the display size', () => {
    const image = venuePinImage(look({}));
    expect(svgOf(image)).toContain(`width="${image.width * 2}"`);
    expect(svgOf(image)).toContain(`viewBox="0 0 ${image.width} ${image.height}"`);
  });
});

describe('z-order', () => {
  const venueZ = (state: Partial<typeof NOTHING>) =>
    venuePinZIndex(venuePinLook(CAFE, { ...NOTHING, ...state }));
  const person = (selected: boolean) => personPinZIndex({ label: 'A', color: '#000', selected });

  it('stacks people above liked and plain venues, and a selected venue above people', () => {
    expect(venueZ({})).toBeLessThan(venueZ({ likes: 1 }));
    expect(venueZ({ likes: 1 })).toBeLessThan(person(false));
    expect(person(false)).toBeLessThan(person(true));
    expect(person(true)).toBeLessThan(venueZ({ isSelected: true }));
    expect(venueZ({ isSelected: true })).toBeLessThan(venueZ({ isPublished: true }));
  });
});

describe('tripLabel', () => {
  it('is short in English', () => {
    expect(tripLabel(8 * 60, 'en')).toBe('8m');
    expect(tripLabel(84 * 60, 'en')).toBe('1h 24m');
    expect(tripLabel(120 * 60, 'en')).toBe('2h');
  });

  it('is short in Chinese', () => {
    expect(tripLabel(8 * 60, 'zh')).toBe('8分');
    expect(tripLabel(84 * 60, 'zh')).toBe('1时24分');
    expect(tripLabel(120 * 60, 'zh')).toBe('2时');
  });

  it('never says a real trip takes no time', () => {
    expect(tripLabel(10, 'en')).toBe('1m');
  });
});

describe('personPinLabel', () => {
  it('calls the viewer You, as their row does', () => {
    expect(personPinLabel('Victor', true, 'en')).toBe('You');
    expect(personPinLabel('Victor', true, 'zh')).toBe('我');
  });

  it('takes the first two characters by code point', () => {
    expect(personPinLabel('Victor', false, 'en')).toBe('Vi');
    expect(personPinLabel('张伟明', false, 'zh')).toBe('张伟');
    expect(personPinLabel('😀😀😀', false, 'en')).toBe('😀😀');
    expect(personPinLabel('  J ', false, 'en')).toBe('J');
  });
});

describe('personPinLook', () => {
  const state = { isSelf: false, isSelected: false, locale: 'en' as const };

  it('has no chip without a trip', () => {
    expect(personPinLook({ name: 'Ana', color: undefined }, state).tripLabel).toBeUndefined();
  });

  it('labels the trip in the locale', () => {
    expect(
      personPinLook({ name: 'Ana', color: undefined }, { ...state, tripSeconds: 5040 }).tripLabel
    ).toBe('1h 24m');
  });

  it('resolves the participant color to a hex value', () => {
    expect(personPinLook({ name: 'Ana', color: undefined }, state).color).toMatch(/^#/);
  });
});

describe('personPinImage', () => {
  const look = { label: 'Vi', color: '#847ce1', selected: false };

  it('anchors at the tip of the tail, below the face', () => {
    const image = personPinImage(look);
    expect(image.anchorX).toBe(image.width / 2);
    expect(image.anchorY).toBeGreaterThan(image.hit.y + image.hit.radius);
    expect(image.anchorY).toBeLessThan(image.height);
  });

  it('draws the chip only when there is a trip', () => {
    expect(textsOf(personPinImage(look))).toEqual(['Vi']);
    expect(textsOf(personPinImage({ ...look, tripLabel: '1h 24m' }))).toEqual(['Vi', '1h 24m']);
  });

  it('is a little larger when selected', () => {
    expect(personPinImage({ ...look, selected: true }).hit.radius).toBeGreaterThan(
      personPinImage(look).hit.radius
    );
  });

  it('rings someone being added in dashes, spinning only when asked', () => {
    const draft = { ...look, draft: true };
    expect(svgOf(personPinImage(draft))).toContain('stroke-dasharray="4 4"');
    expect(svgOf(personPinImage(look))).not.toContain('stroke-dasharray');
    expect(svgOf(personPinImage(draft, true))).toContain('animateTransform');
    expect(svgOf(personPinImage(draft, false))).not.toContain('animateTransform');
  });
});

describe('venuesOnMap', () => {
  const none = { searched: [], venueById: {}, likedIds: [], selected: null, publishedId: null };

  it('keeps liked, published and selected venues through a search that lost them', () => {
    const liked = venue('liked');
    const published = venue('published');
    const selected = venue('selected');
    const ids = venuesOnMap({
      ...none,
      searched: [venue('found')],
      venueById: { liked, published },
      likedIds: ['liked'],
      publishedId: 'published',
      selected,
    }).map(({ id }) => id);
    expect(ids).toEqual(['found', 'liked', 'published', 'selected']);
  });

  it('lists a venue that is both searched and liked once', () => {
    const shared = venue('shared');
    expect(
      venuesOnMap({
        ...none,
        searched: [shared],
        venueById: { shared },
        likedIds: ['shared'],
        selected: shared,
      })
    ).toHaveLength(1);
  });

  it('skips a venue with no location', () => {
    const broken = venue('broken', { location: undefined });
    expect(venuesOnMap({ ...none, searched: [broken] })).toEqual([]);
  });

  it('skips a like whose venue details are not loaded yet', () => {
    expect(venuesOnMap({ ...none, likedIds: ['unknown'] })).toEqual([]);
  });
});

describe('searchHandleBearings', () => {
  it('prefers over the top, then the next free place around', () => {
    expect(searchHandleBearings(() => true)).toEqual({ move: 0, size: 30 });
    expect(searchHandleBearings((bearing) => Math.abs(bearing) >= 60)).toEqual({
      move: 60,
      size: -60,
    });
  });

  it('hides what has nowhere free to go', () => {
    expect(searchHandleBearings((bearing) => bearing === 90)).toEqual({ move: 90, size: null });
    expect(searchHandleBearings(() => false)).toEqual({ move: null, size: null });
  });
});

describe('search area handles', () => {
  it('centers both on the point they drag', () => {
    [SEARCH_MOVE_HANDLE, SEARCH_SIZE_HANDLE].forEach((image) => {
      expect(image.anchorX).toBe(image.width / 2);
      expect(image.anchorY).toBe(image.height / 2);
    });
  });

  it('marks only the move handle with arrows', () => {
    expect(svgOf(SEARCH_MOVE_HANDLE)).toContain('<path');
    expect(svgOf(SEARCH_SIZE_HANDLE)).not.toContain('<path');
  });
});

describe('routeChipLabel', () => {
  it('spells the minutes out', () => {
    expect(routeChipLabel(16 * 60, 'en')).toBe('16 min');
    expect(routeChipLabel(16 * 60, 'zh')).toBe('16分钟');
  });

  it('never rounds a real trip down to zero', () => {
    expect(routeChipLabel(10, 'en')).toBe('1 min');
  });

  it('switches to hours as soon as the minutes round up to one', () => {
    expect(routeChipLabel(3590, 'en')).toBe('1h');
    expect(routeChipLabel(84 * 60, 'zh')).toBe('1时24分');
  });
});

describe('routeChipImage', () => {
  it('outlines the chip in the person color and escapes the label', () => {
    const svg = svgOf(routeChipImage({ color: '#3f7f7c', mode: 'bicycling', label: '<1 min' }));
    expect(svg).toContain('stroke="#3f7f7c"');
    expect(svg).toContain('&lt;1 min');
  });

  it('anchors on its center, so it sits on the line', () => {
    const image = routeChipImage({ color: '#3f7f7c', mode: 'driving', label: '4 min' });
    expect(image.anchorX).toBe(image.width / 2);
    expect(image.anchorY).toBe(image.height / 2);
  });
});

describe('placeRouteChips', () => {
  const toPixel = ({ lat, lng }: { lat: number; lng: number }) => ({ x: lng, y: lat });
  const straight = (from: number, to: number) => [
    { lat: 0, lng: from },
    { lat: 0, lng: to },
  ];
  const chip = (id: string, path = straight(0, 1000)) => ({ id, path, label: '16 min' });

  it('puts a lone chip halfway along its route', () => {
    expect(placeRouteChips([chip('a')], [], toPixel).get('a')).toEqual({ lat: 0, lng: 500 });
  });

  it('moves one of two people on the same route further along', () => {
    const spots = placeRouteChips([chip('a'), chip('b')], [], toPixel);
    expect(spots.get('a')).toEqual({ lat: 0, lng: 500 });
    expect(spots.get('b')).toEqual({ lat: 0, lng: 380 });
  });

  it('keeps a chip off a pin', () => {
    const spots = placeRouteChips([chip('a')], [{ lat: 0, lng: 500 }], toPixel);
    expect(spots.get('a')).toEqual({ lat: 0, lng: 380 });
  });

  it('leaves out a route too short to show one clear of its own pins', () => {
    const pins = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 30 },
    ];
    expect(placeRouteChips([chip('a', straight(0, 30))], pins, toPixel).size).toBe(0);
  });
});
