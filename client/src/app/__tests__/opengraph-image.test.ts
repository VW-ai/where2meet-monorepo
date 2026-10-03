import { describe, expect, it } from 'vitest';
import OpengraphImage from '@/app/opengraph-image';

describe('opengraph-image', () => {
  it('renders a 1200x630 PNG', async () => {
    const response = await OpengraphImage();
    expect(response.headers.get('content-type')).toBe('image/png');

    const png = Buffer.from(await response.arrayBuffer());
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });
});
