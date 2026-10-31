import { describe, it, expect } from 'vitest';
import { isMainlandChinaTimeZone, toPlacePrediction, venueMapsUrl } from '../map-provider';

describe('isMainlandChinaTimeZone', () => {
  it('matches mainland zones only', () => {
    expect(isMainlandChinaTimeZone('Asia/Shanghai')).toBe(true);
    expect(isMainlandChinaTimeZone('Asia/Urumqi')).toBe(true);
    expect(isMainlandChinaTimeZone('Asia/Hong_Kong')).toBe(false);
    expect(isMainlandChinaTimeZone('America/New_York')).toBe(false);
    expect(isMainlandChinaTimeZone(undefined)).toBe(false);
  });
});

describe('toPlacePrediction', () => {
  it('keeps the place name in the address the server geocodes', () => {
    const prediction = toPlacePrediction({
      placeId: 'amap:B000A9KXWR',
      name: '三里屯太古里',
      district: '北京市朝阳区',
      address: '三里屯路19号',
      location: { lat: 39.93, lng: 116.44 },
    });
    expect(prediction).toEqual({
      place_id: 'amap:B000A9KXWR',
      description: '三里屯太古里',
      main_text: '三里屯太古里',
      secondary_text: '北京市朝阳区三里屯路19号',
      full_address: '北京市朝阳区三里屯路19号三里屯太古里',
    });
  });
});

describe('venueMapsUrl', () => {
  const venue = {
    id: 'amap:B000A9KXWR',
    name: 'Taikoo Li',
    address: '三里屯路19号',
    location: { lat: 39.93, lng: 116.44 },
  };

  it('opens AMap with WGS-84 coordinates', () => {
    const url = new URL(venueMapsUrl('amap', venue));
    expect(url.origin + url.pathname).toBe('https://uri.amap.com/marker');
    expect(url.searchParams.get('position')).toBe('116.44,39.93');
    expect(url.searchParams.get('coordinate')).toBe('wgs84');
    expect(url.searchParams.get('name')).toBe('Taikoo Li');
  });

  it('opens Google Maps for Google events', () => {
    expect(venueMapsUrl('google', { ...venue, id: 'ChIJ123' })).toContain(
      'https://www.google.com/maps/search/?api=1&query='
    );
  });
});
