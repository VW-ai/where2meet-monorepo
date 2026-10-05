import { createServer } from "node:http";

type ProviderResponse = { status: number; body: unknown } | { kind: "disconnect" };

export const foundAddress = {
  status: 200,
  body: {
    status: "OK",
    results: [
      {
        formatted_address: "Validated private address",
        geometry: { location: { lat: 32.9, lng: -117.2 } },
      },
    ],
  },
};

export function deferred() {
  let complete: () => void = () => {
    throw new Error("Deferred promise is not initialized");
  };
  const promise = new Promise<void>((resolve) => {
    complete = resolve;
  });
  return {
    promise,
    resolve: () => {
      complete();
    },
  };
}

export async function startGeocoder() {
  const requests: { address: string; key: string }[] = [];
  let respond = (_address: string): Promise<ProviderResponse> => Promise.resolve(foundAddress);
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const address = url.searchParams.get("address") ?? "";
    requests.push({ address, key: url.searchParams.get("key") ?? "" });
    void respond(address)
      .then((result) => {
        if ("kind" in result) {
          response.destroy();
          return;
        }
        response.writeHead(result.status, { "content-type": "application/json" });
        response.end(JSON.stringify(result.body));
      })
      .catch(() => response.destroy());
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing geocoder fixture port");
  return {
    endpoint: `http://127.0.0.1:${String(address.port)}/maps/api/geocode/json`,
    requests,
    respondWith(handler: (address: string) => Promise<ProviderResponse>) {
      respond = handler;
    },
    reset() {
      requests.length = 0;
      respond = () => Promise.resolve(foundAddress);
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
