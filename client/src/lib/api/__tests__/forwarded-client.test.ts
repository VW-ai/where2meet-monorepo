import { describe, expect, it } from 'vitest';
import { forwardedClientHeaders } from '@/lib/api/forwarded-client';

const SECRET = 's'.repeat(40);

describe('forwardedClientHeaders', () => {
  it('names the visitor Vercel saw, with the secret', () => {
    const incoming = new Headers({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '203.0.113.7' });
    expect(forwardedClientHeaders(incoming, SECRET)).toEqual({
      'x-w2m-proxy-secret': SECRET,
      'x-w2m-client-ip': '203.0.113.7',
    });
  });

  it('falls back to the first X-Forwarded-For entry', () => {
    const incoming = new Headers({ 'x-forwarded-for': '198.51.100.4, 10.0.0.1' });
    expect(forwardedClientHeaders(incoming, SECRET)['x-w2m-client-ip']).toBe('198.51.100.4');
  });

  it('sends nothing without a secret or a visitor address', () => {
    expect(forwardedClientHeaders(new Headers({ 'x-real-ip': '203.0.113.7' }), undefined)).toEqual(
      {}
    );
    expect(forwardedClientHeaders(new Headers(), SECRET)).toEqual({});
  });

  it('names the visitor Cloudflare saw when www is proxied through it', () => {
    const incoming = new Headers({
      'x-real-ip': '172.70.42.9',
      'x-forwarded-for': '172.70.42.9',
      'cf-connecting-ip': '203.0.113.7',
    });
    expect(forwardedClientHeaders(incoming, SECRET)['x-w2m-client-ip']).toBe('203.0.113.7');
  });

  it('accepts Cloudflare edges on IPv6 too', () => {
    const incoming = new Headers({
      'x-real-ip': '2a06:98c0:3600::103',
      'cf-connecting-ip': '2001:db8::7',
    });
    expect(forwardedClientHeaders(incoming, SECRET)['x-w2m-client-ip']).toBe('2001:db8::7');
  });

  it('ignores CF-Connecting-IP from a caller that reached Vercel without Cloudflare', () => {
    const incoming = new Headers({
      'x-real-ip': '198.51.100.4',
      'cf-connecting-ip': '203.0.113.7',
    });
    expect(forwardedClientHeaders(incoming, SECRET)['x-w2m-client-ip']).toBe('198.51.100.4');
  });
});
