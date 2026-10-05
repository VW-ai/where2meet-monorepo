import { createServer } from "node:http";

export type ProviderReply =
  | { status: number; body?: unknown; text?: string; location?: string }
  | { kind: "disconnect" };

export function googlePlace(id = "fixture_place", overrides: Record<string, unknown> = {}) {
  return {
    place_id: id,
    name: "Provider cafe",
    formatted_address: "Provider address",
    geometry: { location: { lat: 33.25, lng: -117.75 } },
    types: ["cafe"],
    rating: 4.5,
    user_ratings_total: 123,
    price_level: 2,
    opening_hours: { open_now: false, weekday_text: ["Monday: 9 AM - 5 PM"] },
    photos: [{ photo_reference: "trusted-photo-reference" }],
    formatted_phone_number: "555-0100",
    website: "https://example.test/cafe",
    ...overrides,
  };
}

export function googleRoute(meters = 1609.344, seconds = 600) {
  return {
    status: "OK",
    routes: [
      {
        legs: [{ distance: { value: meters }, duration: { value: seconds } }],
        overview_polyline: { points: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" },
      },
    ],
  };
}

export async function startPlacesProvider() {
  const requests: URL[] = [];
  const defaultResponse = (url: URL): Promise<ProviderReply> => {
    if (url.pathname.endsWith("details/json"))
      return Promise.resolve({
        status: 200,
        body: { status: "OK", result: googlePlace(url.searchParams.get("place_id") ?? "") },
      });
    if (url.pathname.endsWith("photo"))
      return Promise.resolve({
        status: 302,
        location: "https://lh3.googleusercontent.com/safe-image",
      });
    if (url.pathname.endsWith("directions/json"))
      return Promise.resolve({ status: 200, body: googleRoute() });
    return Promise.resolve({ status: 200, body: { status: "OK", results: [googlePlace()] } });
  };
  let respond = defaultResponse;
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    requests.push(url);
    void respond(url)
      .then((result) => {
        if ("kind" in result) {
          response.destroy();
          return;
        }
        response.writeHead(result.status, {
          "content-type": "application/json",
          ...(result.location ? { location: result.location } : {}),
        });
        response.end(result.text ?? JSON.stringify(result.body));
      })
      .catch(() => response.destroy());
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing provider fixture port");
  const origin = `http://127.0.0.1:${String(address.port)}`;
  return {
    endpoint: `${origin}/maps/api/place/`,
    directionsEndpoint: `${origin}/maps/api/directions/json`,
    requests,
    defaultResponse,
    respondWith(handler: (url: URL) => Promise<ProviderReply>) {
      respond = handler;
    },
    reset() {
      requests.length = 0;
      respond = defaultResponse;
    },
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}
