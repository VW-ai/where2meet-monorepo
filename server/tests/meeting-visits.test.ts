/**
 * Meeting visit recording: one meeting_visit row per meeting-page stream.
 *
 * Streams run over a real socket because inject() waits for a response to end.
 * Rows are read with SQL so the test pins the table the usage panel reads.
 * They are polled with expect.poll because vi.waitFor advances fake timers, and so the
 * faked Date, by 50 ms on every check.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { once } from "node:events";
import type { ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";

vi.mock("../src/lib/maps.js", () => ({
  geocode: vi.fn().mockResolvedValue({
    lat: 40.7484,
    lng: -73.9857,
    formattedAddress: "350 5th Ave, New York, NY 10118, USA",
  }),
  isMapsConfigured: vi.fn().mockReturnValue(true),
}));

const T0 = new Date("2026-10-20T12:00:00.000Z");
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

interface Meeting {
  eventId: string;
  organizer: { id: string; token: string };
  participant: { id: string; token: string };
}

interface Stream {
  status: number;
  firstEvent: string;
  close: () => void;
}

describe("meeting visits", () => {
  let server: FastifyInstance;
  let baseUrl: string;
  const streams: AbortController[] = [];

  beforeAll(async () => {
    server = await buildServer();
    await server.listen({ port: 0, host: "127.0.0.1" });
    baseUrl = `http://127.0.0.1:${(server.server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await server.close();
  });

  afterEach(async () => {
    streams.splice(0).forEach((controller) => controller.abort());
    vi.useRealTimers();
    await server.db.$executeRawUnsafe("DROP TRIGGER IF EXISTS reject_visits ON meeting_visit");
    await server.db.$executeRawUnsafe("DROP FUNCTION IF EXISTS reject_visit_write");
  });

  async function createMeeting(): Promise<Meeting> {
    const event = (
      await server.inject({ method: "POST", url: "/api/events", payload: { title: "Visits" } })
    ).json();
    const participant = (
      await server.inject({
        method: "POST",
        url: `/api/events/${event.id}/participants`,
        payload: { name: "Bea", address: "350 5th Ave" },
      })
    ).json();
    return {
      eventId: event.id,
      organizer: { id: event.organizerParticipantId, token: event.participantToken },
      participant: { id: participant.id, token: participant.participantToken },
    };
  }

  async function openStream(eventId: string, token?: string): Promise<Stream> {
    const controller = new AbortController();
    streams.push(controller);
    const response = await fetch(`${baseUrl}/api/events/${eventId}/stream`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    });
    let firstEvent = "";
    if (response.ok && response.body) {
      const { value } = await response.body.getReader().read();
      firstEvent = new TextDecoder().decode(value);
    } else {
      await response.text();
    }
    return { status: response.status, firstEvent, close: () => controller.abort() };
  }

  const visits = (eventId: string) =>
    server.db.$queryRaw`
      SELECT participant_id, started_at, last_seen_at FROM meeting_visit
      WHERE event_id = ${eventId} ORDER BY started_at, participant_id`;

  it("records a participant's visit from connect, every 30 s while open, and at disconnect", async () => {
    const { eventId, participant } = await createMeeting();
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"], now: T0 });

    const stream = await openStream(eventId, participant.token);
    expect(stream.status).toBe(200);
    await expect.poll(() => visits(eventId)).toEqual([
      { participant_id: participant.id, started_at: T0, last_seen_at: T0 },
    ]);

    await vi.advanceTimersByTimeAsync(30_000);
    await expect.poll(() => visits(eventId)).toEqual([
      { participant_id: participant.id, started_at: T0, last_seen_at: at(30) },
    ]);

    await vi.advanceTimersByTimeAsync(15_000);
    stream.close();
    await expect.poll(() => visits(eventId)).toEqual([
      { participant_id: participant.id, started_at: T0, last_seen_at: at(45) },
    ]);
  });

  it("attributes the organizer's stream to the organizer's participant row", async () => {
    const { eventId, organizer } = await createMeeting();
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"], now: T0 });

    const stream = await openStream(eventId, organizer.token);
    await expect.poll(() => visits(eventId)).toEqual([
      { participant_id: organizer.id, started_at: T0, last_seen_at: T0 },
    ]);
    stream.close();
  });

  it("records one row per stream, so a second tab is its own visit", async () => {
    const { eventId, participant } = await createMeeting();
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"], now: T0 });

    const first = await openStream(eventId, participant.token);
    vi.setSystemTime(at(10));
    const second = await openStream(eventId, participant.token);
    vi.setSystemTime(at(20));
    second.close();
    await expect.poll(() => visits(eventId)).toEqual([
      { participant_id: participant.id, started_at: T0, last_seen_at: T0 },
      { participant_id: participant.id, started_at: at(10), last_seen_at: at(20) },
    ]);

    vi.setSystemTime(at(25));
    first.close();
    await expect.poll(() => visits(eventId)).toEqual([
      { participant_id: participant.id, started_at: T0, last_seen_at: at(25) },
      { participant_id: participant.id, started_at: at(10), last_seen_at: at(20) },
    ]);
  });

  it("records nothing for a stream it refuses: no token, a bad token, or another meeting's token", async () => {
    const meeting = await createMeeting();
    const other = await createMeeting();

    const refused = [
      await openStream(meeting.eventId),
      await openStream(meeting.eventId, "pt_not_a_real_token"),
      await openStream(meeting.eventId, other.participant.token),
    ].map((stream) => stream.status);
    expect(refused).toEqual([401, 403, 403]);

    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"], now: T0 });
    const accepted = await openStream(meeting.eventId, meeting.participant.token);
    await expect.poll(() => visits(meeting.eventId)).toEqual([
      { participant_id: meeting.participant.id, started_at: T0, last_seen_at: T0 },
    ]);
    accepted.close();
  });

  it("records no visit for a client that leaves before its stream is accepted", async () => {
    const { eventId, organizer, participant } = await createMeeting();
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"], now: T0 });

    await server.db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("LOCK TABLE participant IN ACCESS EXCLUSIVE MODE");
        const arrived = new Promise<ServerResponse>((resolve) => {
          server.server.once("request", (_request, response) => resolve(response));
        });
        const controller = new AbortController();
        streams.push(controller);
        fetch(`${baseUrl}/api/events/${eventId}/stream`, {
          headers: { authorization: `Bearer ${organizer.token}` },
          signal: controller.signal,
        }).catch(() => undefined);
        const response = await arrived;
        controller.abort();
        await once(response, "close");
      },
      { timeout: 10_000 }
    );

    const stream = await openStream(eventId, participant.token);
    await expect.poll(() => visits(eventId)).toEqual([
      { participant_id: participant.id, started_at: T0, last_seen_at: T0 },
    ]);
    stream.close();
  });

  it("opens the stream without waiting on a visit write that hangs and then fails", async () => {
    const { eventId, participant } = await createMeeting();
    await server.db.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION reject_visit_write() RETURNS trigger AS $$
      BEGIN PERFORM pg_sleep(2); RAISE EXCEPTION 'visit recording is down'; END $$
      LANGUAGE plpgsql`);
    await server.db.$executeRawUnsafe(`
      CREATE TRIGGER reject_visits BEFORE INSERT OR UPDATE ON meeting_visit
      FOR EACH ROW EXECUTE FUNCTION reject_visit_write()`);

    const startedAt = performance.now();
    const stream = await openStream(eventId, participant.token);
    const firstEventAfterMs = performance.now() - startedAt;
    stream.close();

    expect({
      status: stream.status,
      firstEvent: stream.firstEvent.split("\n")[0],
      underOneSecond: firstEventAfterMs < 1000,
    }).toEqual({ status: 200, firstEvent: "event: heartbeat", underOneSecond: true });
  });
});
