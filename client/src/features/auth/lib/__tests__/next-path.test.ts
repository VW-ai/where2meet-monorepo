import { describe, expect, it } from 'vitest';
import { nextPathFrom } from '../next-path';

describe('nextPathFrom', () => {
  it('returns a path on this site and refuses anything that leaves it', () => {
    expect(nextPathFrom('?next=%2Fmeet%2Fabc')).toBe('/meet/abc');
    expect(nextPathFrom('')).toBe('/dashboard');
    expect(nextPathFrom('?next=https://evil.example')).toBe('/dashboard');
    expect(nextPathFrom('?next=//evil.example')).toBe('/dashboard');
    expect(nextPathFrom('?next=/%5Cevil.example')).toBe('/dashboard');
  });
});
