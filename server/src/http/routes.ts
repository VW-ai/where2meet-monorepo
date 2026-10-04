import type { FastifyInstance, HTTPMethods } from "fastify";
import type { Meetings, MeetingSnapshot } from "../modules/meetings/index.js";
import type { Accounts, AccountProfile } from "../modules/accounts/index.js";
import { AppError } from "../errors.js";
import { bearer } from "./sse.js";
import {
  createEventBody,
  updateEventBody,
  eventParams,
  participantParams,
  participantBody,
  response,
  eventResponse,
  createResponse,
  participantResponse,
  meResponse,
  votesResponse,
  sessionResponse,
} from "./schemas.js";

function eventWire(meeting: MeetingSnapshot) {
  return {
    ...meeting,
    meetingTime: meeting.meetingTime?.toISOString() ?? null,
    publishedAt: meeting.publishedAt?.toISOString() ?? null,
    createdAt: meeting.createdAt.toISOString(),
    updatedAt: meeting.updatedAt.toISOString(),
    mec: null,
    settings: { allowParticipantsAfterPublish: false },
  };
}

function userWire(user: AccountProfile) {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function registerRoutes(app: FastifyInstance, meetings: Meetings, accounts: Accounts): void {
  app.post("/api/events", async (request, reply) => {
    const body = createEventBody.parse(request.body);
    const result = await meetings.create({
      title: body.title,
      meetingTime: body.meetingTime ? new Date(body.meetingTime) : null,
    });
    return reply.code(201).send(
      response(createResponse, {
        ...eventWire(result.meeting),
        participantToken: result.participantToken,
        organizerParticipantId: result.organizerParticipantId,
      })
    );
  });
  app.get("/api/events/:id", async (request) => {
    const { id } = eventParams.parse(request.params);
    return response(eventResponse, eventWire(await meetings.get(id)));
  });
  app.get("/api/events/:id/me", async (request) => {
    const credential = bearer(request.headers.authorization);
    const { id } = eventParams.parse(request.params);
    const participant = await meetings.identify({ eventId: id, credential });
    return response(meResponse, {
      participantId: participant.id,
      name: participant.name,
      isOrganizer: participant.isOrganizer,
      color: participant.color,
      address: participant.address,
      lat: participant.location?.lat ?? null,
      lng: participant.location?.lng ?? null,
    });
  });
  app.patch("/api/events/:id", async (request) => {
    const credential = bearer(request.headers.authorization);
    const { id } = eventParams.parse(request.params);
    const body = updateEventBody.parse(request.body);
    const meeting = await meetings.update({
      eventId: id,
      credential,
      patch: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.meetingTime !== undefined
          ? { meetingTime: body.meetingTime === null ? null : new Date(body.meetingTime) }
          : {}),
      },
    });
    return response(eventResponse, eventWire(meeting));
  });
  app.patch("/api/events/:id/participants/:participantId", async (request) => {
    const credential = bearer(request.headers.authorization);
    const { id, participantId } = participantParams.parse(request.params);
    const body = participantBody.parse(request.body);
    if (body.address !== undefined || body.fuzzyLocation !== undefined)
      throw new AppError(
        "FEATURE_NOT_AVAILABLE",
        "Location changes are not available in this migration stage"
      );
    if (body.name === undefined) throw new AppError("VALIDATION_ERROR", "Name is required");
    return response(
      participantResponse,
      await meetings.renameParticipant({ eventId: id, credential, participantId, name: body.name })
    );
  });
  app.delete("/api/events/:id", async (request) => {
    const credential = bearer(request.headers.authorization);
    const { id } = eventParams.parse(request.params);
    await meetings.remove({ eventId: id, credential });
    return { success: true, message: "Event deleted successfully" };
  });
  app.get("/api/events/:id/votes", async (request) => {
    const { id } = eventParams.parse(request.params);
    return response(votesResponse, await meetings.votes(id));
  });
  app.get("/api/auth/session", async (request) => {
    const credential = request.cookies.session_token;
    if (!credential) throw new AppError("UNAUTHORIZED", "Session required");
    const session = await accounts.session(credential);
    return response(sessionResponse, { user: userWire(session.user) });
  });

  const unavailable: [HTTPMethods, string][] = [
    ["POST", "/api/auth/register"],
    ["POST", "/api/auth/login"],
    ["POST", "/api/auth/logout"],
    ["GET", "/api/users/me"],
    ["PATCH", "/api/users/me"],
    ["GET", "/api/users/me/events"],
    ["POST", "/api/users/me/events/claim"],
    ["GET", "/api/events/:id/mec"],
    ["POST", "/api/events/:id/publish"],
    ["DELETE", "/api/events/:id/publish"],
    ["POST", "/api/events/:id/participants"],
    ["DELETE", "/api/events/:id/participants/:participantId"],
    ["POST", "/api/events/:id/participants/:participantId/votes"],
    ["DELETE", "/api/events/:id/participants/:participantId/votes/:venueId"],
    ["GET", "/api/events/:id/votes/statistics"],
    ["GET", "/api/events/:id/venues/:venueId/directions"],
    ["POST", "/api/venues/search"],
    ["GET", "/api/venues/:id"],
  ];
  for (const [method, url] of unavailable) {
    app.route({
      method,
      url,
      handler: () => {
        throw new AppError(
          "FEATURE_NOT_AVAILABLE",
          "This operation is not available in this migration stage"
        );
      },
    });
  }
}
