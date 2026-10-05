import { z } from "zod";

export async function openStream(url: string, token: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 10000);
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    signal: controller.signal,
  });
  if (response.status !== 200 || !response.body) {
    clearTimeout(timeout);
    controller.abort();
    throw new Error(`Stream returned ${String(response.status)}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  return {
    async next(type: string): Promise<unknown> {
      for (;;) {
        const boundary = buffer.indexOf("\n\n");
        if (boundary !== -1) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          if (frame.startsWith(`event: ${type}\n`)) {
            const data = frame.split("\n").find((line) => line.startsWith("data: "));
            if (!data) throw new Error("Missing SSE data");
            const parsed: unknown = JSON.parse(data.slice(6));
            return parsed;
          }
          continue;
        }
        const chunk = await reader.read();
        if (chunk.done) throw new Error(`Stream ended before ${type}`);
        buffer += decoder.decode(z.instanceof(Uint8Array).parse(chunk.value), { stream: true });
      }
    },
    async close() {
      clearTimeout(timeout);
      await reader.cancel();
      controller.abort();
    },
  };
}
