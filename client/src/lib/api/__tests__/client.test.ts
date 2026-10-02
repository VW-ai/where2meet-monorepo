import { afterEach, describe, expect, it, vi } from 'vitest';
import { APIError, apiErrorFromResponse, backendCall } from '@/lib/api/client';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiErrorFromResponse', () => {
  it('reads the backend’s nested error format', () => {
    const error = apiErrorFromResponse(404, {
      error: { code: 'EVENT_NOT_FOUND', message: 'Event evt_1 not found' },
    });
    expect(error).toBeInstanceOf(APIError);
    expect(error.status).toBe(404);
    expect(error.code).toBe('EVENT_NOT_FOUND');
    expect(error.message).toBe('Event evt_1 not found');
  });

  it('keeps nested details', () => {
    const error = apiErrorFromResponse(400, {
      error: { code: 'VALIDATION_ERROR', message: 'Bad input', details: { field: 'name' } },
    });
    expect(error.details).toEqual({ field: 'name' });
  });

  it('accepts a flat error body', () => {
    const error = apiErrorFromResponse(401, { error: 'UNAUTHORIZED', message: 'Sign in first' });
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.message).toBe('Sign in first');
  });

  it('falls back when the body is empty or not JSON', () => {
    for (const body of [{}, null, 'oops']) {
      const error = apiErrorFromResponse(502, body);
      expect(error.code).toBe('UNKNOWN_ERROR');
      expect(error.message).toBe('Request failed with status 502');
    }
  });
});

describe('backendCall errors', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('surfaces the backend’s code and message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(400, {
          error: { code: 'ADDRESS_NOT_FOUND', message: 'Could not geocode address: nowhere' },
        })
      )
    );

    const error = await backendCall('/api/events/evt_1/participants').catch((e) => e);
    expect(error).toBeInstanceOf(APIError);
    expect(error).toMatchObject({
      status: 400,
      code: 'ADDRESS_NOT_FOUND',
      message: 'Could not geocode address: nowhere',
    });
  });

  it('reports network failures as NETWORK_ERROR', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    const error = await backendCall('/api/events/evt_1').catch((e) => e);
    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });
});
