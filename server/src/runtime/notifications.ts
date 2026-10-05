import { Redis } from "ioredis";

type Listener = (frame: string) => void;

export interface Notifications {
  currentSequence(eventId: string): Promise<number>;
  advanceSequence(eventId: string): Promise<number>;
  publish(eventId: string, frame: string): Promise<void>;
  subscribe(eventId: string, listener: Listener): () => void;
  ready(): Promise<boolean>;
  close(): void;
}

export async function createNotifications(options: {
  url: string;
  timeoutMs: number;
  reportFailure: () => void;
}): Promise<Notifications> {
  const settings = {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: options.timeoutMs,
    commandTimeout: options.timeoutMs,
    retryStrategy: (attempt: number) => Math.min(attempt * 250, 3000),
  };
  const publisher = new Redis(options.url, settings);
  const subscriber = new Redis(options.url, settings);
  const listeners = new Map<string, Set<Listener>>();
  const prefix = "where2meet:sse:event:";
  let subscribed = false;
  for (const connection of [publisher, subscriber]) connection.on("error", options.reportFailure);
  subscriber.on("close", () => {
    subscribed = false;
  });
  subscriber.on("ready", () => {
    void subscriber
      .psubscribe(`${prefix}*`)
      .then(() => {
        subscribed = true;
      })
      .catch(options.reportFailure);
  });
  subscriber.on("pmessage", (_pattern: string, channel: string, frame: string) => {
    for (const listener of listeners.get(channel.slice(prefix.length)) ?? []) listener(frame);
  });
  await Promise.allSettled([publisher.connect(), subscriber.connect()]);
  if (subscriber.status === "ready") {
    try {
      await subscriber.psubscribe(`${prefix}*`);
      subscribed = true;
    } catch {
      options.reportFailure();
    }
  }
  function sequence(value: string | number | null): number {
    const parsed = Number(value);
    if (
      (typeof value === "string" && !/^\d+$/.test(value)) ||
      !Number.isSafeInteger(parsed) ||
      parsed < 0
    ) {
      options.reportFailure();
      return 0;
    }
    return parsed;
  }
  return {
    async currentSequence(eventId) {
      try {
        return sequence(await publisher.get(`sse:seq:${eventId}`));
      } catch {
        options.reportFailure();
        return 0;
      }
    },
    async advanceSequence(eventId) {
      try {
        return sequence(await publisher.incr(`sse:seq:${eventId}`));
      } catch {
        options.reportFailure();
        return 0;
      }
    },
    async publish(eventId, frame) {
      try {
        await publisher.publish(`${prefix}${eventId}`, frame);
      } catch (error) {
        for (const listener of listeners.get(eventId) ?? []) listener(frame);
        throw error;
      }
    },
    subscribe(eventId, listener) {
      const group = listeners.get(eventId) ?? new Set<Listener>();
      group.add(listener);
      listeners.set(eventId, group);
      return () => {
        group.delete(listener);
        if (!group.size) listeners.delete(eventId);
      };
    },
    async ready() {
      if (publisher.status !== "ready" || subscriber.status !== "ready" || !subscribed)
        return false;
      try {
        await publisher.ping();
        return true;
      } catch {
        return false;
      }
    },
    close() {
      listeners.clear();
      publisher.disconnect();
      subscriber.disconnect();
    },
  };
}
