/**
 * SSE (Server-Sent Events) plugin module.
 *
 * Provides connection management and broadcasting for real-time updates.
 * Uses Redis pub/sub for horizontal scaling across multiple server instances.
 * @module plugins/sse
 */

import type { FastifyInstance, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { randomUUID } from "crypto";
import { Redis } from "ioredis";
import { config } from "../lib/config.js";
import { createLogger } from "../lib/logger.js";
import type {
  SSEConnection,
  SSEEventType,
  SSEPayload,
  BroadcastOptions,
} from "../types/sse.js";

const logger = createLogger("SSEPlugin");

/**
 * SSE service for managing connections and broadcasting events.
 */
export class SSEService {
  /** Map of eventId -> Set of connections */
  private connections = new Map<string, Set<SSEConnection>>();

  /** Redis client for pub/sub (subscriber) */
  private subscriber: Redis | null = null;

  /** Redis client for publishing */
  private publisher: Redis | null = null;

  /** Heartbeat interval timer */
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /** Set of subscribed Redis channels */
  private subscribedChannels = new Set<string>();

  /**
   * Initializes the SSE service with Redis pub/sub.
   * @param redisUrl - Redis connection URL
   */
  async initialize(redisUrl: string): Promise<void> {
    try {
      this.publisher = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
      await this.publisher.connect();

      this.subscriber = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
      await this.subscriber.connect();

      // Handle incoming messages from Redis pub/sub
      this.subscriber.on("message", (channel: string, message: string) => {
        this.handleRedisMessage(channel, message);
      });

      // Start heartbeat interval
      this.startHeartbeat();

      logger.info("SSE service initialized with Redis pub/sub");
    } catch (error) {
      logger.warn({ err: error }, "Failed to initialize Redis pub/sub, running in local-only mode");
      // Continue without Redis - local broadcasts will still work
    }
  }

  /**
   * Shuts down the SSE service, cleaning up all connections.
   */
  async shutdown(): Promise<void> {
    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all SSE connections
    for (const [_eventId, connectionSet] of this.connections) {
      for (const connection of connectionSet) {
        this.sendEvent(connection.reply, "close", { reason: "server_shutdown" });
        connection.reply.raw.end();
      }
      connectionSet.clear();
    }
    this.connections.clear();

    // Disconnect Redis
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
    if (this.publisher) {
      await this.publisher.quit();
      this.publisher = null;
    }

    logger.info("SSE service shut down");
  }

  /**
   * Registers a new SSE connection.
   * @param eventId - Event ID to subscribe to
   * @param reply - Fastify reply object
   * @param options - Connection options
   * @returns Connection ID
   */
  async addConnection(
    eventId: string,
    reply: FastifyReply,
    options: { participantId?: string; isOrganizer: boolean }
  ): Promise<string> {
    const connectionId = randomUUID();
    const connection: SSEConnection = {
      id: connectionId,
      eventId,
      reply,
      connectedAt: new Date(),
      participantId: options.participantId,
      isOrganizer: options.isOrganizer,
    };

    // Add to connection registry
    if (!this.connections.has(eventId)) {
      this.connections.set(eventId, new Set());

      // Subscribe to Redis channel for this event
      await this.subscribeToEvent(eventId);
    }
    const connectionSet = this.connections.get(eventId);
    if (connectionSet) {
      connectionSet.add(connection);
    }

    // Set up connection cleanup on close
    reply.raw.on("close", () => {
      this.removeConnection(eventId, connectionId);
    });

    logger.info(
      { eventId, connectionId, isOrganizer: options.isOrganizer },
      "SSE connection added"
    );

    return connectionId;
  }

  /**
   * Removes a connection from the registry.
   * @param eventId - Event ID
   * @param connectionId - Connection ID to remove
   */
  removeConnection(eventId: string, connectionId: string): void {
    const connectionSet = this.connections.get(eventId);
    if (!connectionSet) return;

    for (const connection of connectionSet) {
      if (connection.id === connectionId) {
        connectionSet.delete(connection);
        logger.info({ eventId, connectionId }, "SSE connection removed");
        break;
      }
    }

    // Clean up empty event sets and unsubscribe from Redis
    if (connectionSet.size === 0) {
      this.connections.delete(eventId);
      this.unsubscribeFromEvent(eventId);
    }
  }

  /**
   * Broadcasts an event to all connections for an event.
   * Publishes to Redis for cross-instance delivery.
   * @param options - Broadcast options
   */
  async broadcast(options: BroadcastOptions): Promise<void> {
    const { eventId, type, payload } = options;

    // Publish to Redis for cross-instance delivery
    if (this.publisher) {
      const channel = `sse:event:${eventId}`;
      const message = JSON.stringify({ type, payload });
      try {
        await this.publisher.publish(channel, message);
        logger.debug({ eventId, type }, "Published SSE event to Redis");
      } catch (error) {
        logger.error({ err: error, eventId, type }, "Failed to publish to Redis");
        // Fall back to local-only broadcast
        this.broadcastLocal(eventId, type, payload);
      }
    } else {
      // No Redis, broadcast locally only
      this.broadcastLocal(eventId, type, payload);
    }
  }

  /**
   * Gets the number of active connections for an event.
   * @param eventId - Event ID
   * @returns Connection count
   */
  getConnectionCount(eventId: string): number {
    return this.connections.get(eventId)?.size ?? 0;
  }

  /**
   * Gets total number of active connections across all events.
   * @returns Total connection count
   */
  getTotalConnectionCount(): number {
    let total = 0;
    for (const connectionSet of this.connections.values()) {
      total += connectionSet.size;
    }
    return total;
  }

  /**
   * Broadcasts an event to local connections only (single instance).
   */
  private broadcastLocal(eventId: string, type: SSEEventType, payload: SSEPayload): void {
    const connectionSet = this.connections.get(eventId);
    if (!connectionSet) return;

    for (const connection of connectionSet) {
      this.sendEvent(connection.reply, type, payload);
    }

    logger.debug(
      { eventId, type, connectionCount: connectionSet.size },
      "Broadcast SSE event locally"
    );
  }

  /**
   * Sends an SSE event to a single connection.
   */
  private sendEvent(reply: FastifyReply, type: string, payload: unknown): void {
    try {
      const data = JSON.stringify(payload);
      reply.raw.write(`event: ${type}\n`);
      reply.raw.write(`data: ${data}\n\n`);
    } catch {
      // Connection may have closed, ignore errors
    }
  }

  /**
   * Handles incoming messages from Redis pub/sub.
   */
  private handleRedisMessage(channel: string, message: string): void {
    // Extract eventId from channel name (sse:event:{eventId})
    const match = /^sse:event:(.+)$/.exec(channel);
    if (!match?.[1]) return;

    const eventId = match[1];
    try {
      const { type, payload } = JSON.parse(message) as { type: SSEEventType; payload: SSEPayload };
      this.broadcastLocal(eventId, type, payload);
    } catch (error) {
      logger.error({ err: error, channel, message }, "Failed to parse Redis message");
    }
  }

  /**
   * Subscribes to Redis channel for an event.
   */
  private async subscribeToEvent(eventId: string): Promise<void> {
    if (!this.subscriber) return;

    const channel = `sse:event:${eventId}`;
    if (this.subscribedChannels.has(channel)) return;

    try {
      await this.subscriber.subscribe(channel);
      this.subscribedChannels.add(channel);
      logger.debug({ eventId, channel }, "Subscribed to Redis channel");
    } catch (error) {
      logger.error({ err: error, eventId }, "Failed to subscribe to Redis channel");
    }
  }

  /**
   * Unsubscribes from Redis channel for an event.
   */
  private unsubscribeFromEvent(eventId: string): void {
    if (!this.subscriber) return;

    const channel = `sse:event:${eventId}`;
    if (!this.subscribedChannels.has(channel)) return;

    this.subscriber.unsubscribe(channel).catch((error: unknown) => {
      logger.error({ err: error, eventId }, "Failed to unsubscribe from Redis channel");
    });
    this.subscribedChannels.delete(channel);
    logger.debug({ eventId, channel }, "Unsubscribed from Redis channel");
  }

  /**
   * Starts the heartbeat interval to keep connections alive.
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const timestamp = new Date().toISOString();
      for (const [eventId, connectionSet] of this.connections) {
        for (const connection of connectionSet) {
          this.sendEvent(connection.reply, "heartbeat", { timestamp });
        }
        logger.debug(
          { eventId, connectionCount: connectionSet.size },
          "Sent heartbeat to connections"
        );
      }
    }, config.SSE_HEARTBEAT_INTERVAL_MS);
  }
}

// Singleton SSE service instance
let sseService: SSEService | null = null;

/**
 * Gets or creates the SSE service instance.
 */
export function getSSEService(): SSEService {
  sseService ??= new SSEService();
  return sseService;
}

/**
 * Extends Fastify instance type to include sse property.
 */
declare module "fastify" {
  interface FastifyInstance {
    sse: SSEService;
  }
}

/**
 * Fastify plugin that decorates the instance with SSE service.
 *
 * Usage: `fastify.sse.broadcast({ eventId, type, payload })`
 */
async function ssePlugin(fastify: FastifyInstance): Promise<void> {
  const service = getSSEService();

  // Initialize with Redis
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  await service.initialize(redisUrl);

  // Decorate fastify instance with SSE service
  fastify.decorate("sse", service);

  // Graceful shutdown
  fastify.addHook("onClose", async () => {
    await service.shutdown();
  });

  logger.info("SSE plugin registered");
}

export default fp(ssePlugin, {
  name: "sse",
  dependencies: ["db"],
});
