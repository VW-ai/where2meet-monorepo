import type { FastifyInstance } from "fastify";
import type { MeetingNotice, Meetings } from "../modules/meetings/index.js";
import type { Notifications } from "../runtime/notifications.js";
import type { AppConfig } from "../runtime/config.js";
import { eventParams } from "./schemas.js";
import { AppError } from "../errors.js";

export function bearer(authorization: string | undefined): string {
  if (!authorization?.startsWith("Bearer ") || !authorization.slice(7).trim())
    throw new AppError("UNAUTHORIZED", "Authorization header with Bearer token is required");
  return authorization.slice(7).trim();
}

function frame(type: string, data: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function encodeNotice(eventId: string, notice: MeetingNotice): string {
  if (notice.kind === "meeting-updated") {
    const meeting = notice.meeting;
    return frame("event:updated", {
      event: {
        id: meeting.id,
        title: meeting.title,
        meetingTime: meeting.meetingTime?.toISOString() ?? null,
        publishedAt: meeting.publishedAt?.toISOString() ?? null,
        publishedVenueId: meeting.publishedVenueId,
      },
    });
  }
  if (notice.kind === "participant-removed")
    return frame("participant:removed", { participantId: notice.participantId });
  if (notice.kind === "votes-updated")
    return frame("vote:statistics", {
      eventId,
      venues: notice.votes.venues.map((venue) => ({
        venueId: venue.id,
        voteCount: venue.voters.length,
        voterIds: venue.voters,
      })),
      totalVotes: notice.votes.totalVotes,
      updatedAt: new Date().toISOString(),
    });
  const participant = notice.participant;
  return frame(notice.kind === "participant-added" ? "participant:added" : "participant:updated", {
    participant: {
      id: participant.id,
      name: participant.name,
      address: participant.address,
      lat: participant.location?.lat ?? null,
      lng: participant.location?.lng ?? null,
      color: participant.color,
      isOrganizer: participant.isOrganizer,
      fuzzyLocation: participant.fuzzyLocation,
    },
  });
}

export function registerSSE(
  app: FastifyInstance,
  meetings: Meetings,
  notifications: Notifications,
  config: AppConfig
): void {
  const closeStreams = new Set<() => void>();
  app.addHook("preClose", () => {
    for (const close of closeStreams) close();
    return Promise.resolve();
  });
  app.get("/api/events/:id/stream", async (request, reply) => {
    const { id } = eventParams.parse(request.params);
    await meetings.authorizeStream({
      eventId: id,
      credential: bearer(request.headers.authorization),
    });
    const origin = request.headers.origin;
    if (origin && !config.corsOrigins.includes("*") && !config.corsOrigins.includes(origin))
      throw new AppError("FORBIDDEN", "Origin not allowed");
    reply.hijack();
    for (const [name, value] of Object.entries(reply.getHeaders())) {
      if (value !== undefined) reply.raw.setHeader(name, value);
    }
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    if (origin) {
      reply.raw.setHeader("Access-Control-Allow-Origin", origin);
      reply.raw.setHeader("Access-Control-Allow-Credentials", "true");
      reply.raw.setHeader("Vary", "Origin");
    }
    let closed = false;
    const write = (message: string) => {
      if (closed) return;
      if (!reply.raw.write(message)) close();
    };
    const unsubscribe = notifications.subscribe(id, write);
    const heartbeat = setInterval(() => {
      write(frame("heartbeat", { timestamp: new Date().toISOString() }));
    }, config.heartbeatIntervalMs);
    const timeout = setTimeout(() => {
      close();
    }, config.streamTimeoutMs);
    function close() {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      clearTimeout(timeout);
      unsubscribe();
      closeStreams.delete(close);
      reply.raw.end();
    }
    closeStreams.add(close);
    reply.raw.on("close", close);
    reply.raw.on("error", close);
    write(frame("heartbeat", { timestamp: new Date().toISOString() }));
    return reply;
  });
}
