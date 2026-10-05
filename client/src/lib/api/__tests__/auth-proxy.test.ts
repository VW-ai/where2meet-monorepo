import { createServer, type Server } from 'node:http';
import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const servers: Server[] = [];
async function listen(server: Server) {
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test address');
  return `http://127.0.0.1:${address.port}`;
}
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          if (!server.listening) {
            resolve();
            return;
          }
          server.close((error) => (error ? reject(error) : resolve()));
          server.closeAllConnections();
        })
    )
  );
});

it('proxies a real response but refuses to send an account request to a redirect sink', async () => {
  let sinkRequests = 0;
  const sink = await listen(
    createServer((_request, response) => {
      sinkRequests++;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ user: { id: 'unexpected-sink' } }));
    })
  );
  const backend = await listen(
    createServer((request, response) => {
      if (request.url === '/api/auth/login') {
        response.writeHead(307, { location: sink + '/received' });
        response.end();
      } else {
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ user: { id: 'real-backend' } }));
      }
    })
  );
  vi.stubEnv('BACKEND_URL', backend);
  vi.stubEnv('NEXT_PUBLIC_MOCK_MODE', 'off');
  vi.resetModules();
  const { routeAuthUserRequest } = await import('../auth-user-router');
  const mock = async () => NextResponse.json({ incorrect: 'mock' });
  const control = await routeAuthUserRequest(
    new NextRequest('http://localhost/api/auth/session'),
    'auth',
    '/session',
    mock
  );
  expect(control.status).toBe(200);
  expect(await control.json()).toEqual({ user: { id: 'real-backend' } });
  const response = await routeAuthUserRequest(
    new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: 'session_token=synthetic' },
      body: JSON.stringify({ email: 'synthetic@example.test', password: 'Synthetic-only' }),
    }),
    'auth',
    '/login',
    mock
  );
  expect(response.status).toBe(502);
  expect((await response.json()).error.code).toBe('PROXY_ERROR');
  expect(sinkRequests).toBe(0);
});
