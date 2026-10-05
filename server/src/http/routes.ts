import type { FastifyInstance, FastifyRequest, HTTPMethods } from "fastify";
import type {
  Meetings,
  MeetingSnapshot,
  ParticipantLocationEdit,
  AccountClaim,
} from "../modules/meetings/index.js";
import type { Accounts, AccountProfile } from "../modules/accounts/index.js";
import { AppError } from "../errors.js";
import { bearer } from "./sse.js";
import {
  createEventBody,
  createParticipantBody,
  joinedParticipantResponse,
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
  userResponse,
  registerBody,
  loginBody,
  profileBody,
  claimBody,
  claimResponse,
  accountEventsResponse,
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

function requiredSessionCookie(request: FastifyRequest): string {
  const credential = request.cookies.session_token;
  if (!credential) throw new AppError("UNAUTHORIZED", "Session required");
  return credential;
}

function claimWire(claim: AccountClaim) {
  return { ...claim, createdAt: claim.createdAt.toISOString() };
}

export function registerRoutes(
  app: FastifyInstance,
  meetings: Meetings,
  accounts: Accounts,
  secureCookies: boolean
): void {
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
    const { participant, privateAddress } = await meetings.identify({ eventId: id, credential });
    return response(meResponse, {
      participantId: participant.id,
      name: participant.name,
      isOrganizer: participant.isOrganizer,
      color: participant.color,
      address: privateAddress,
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
    const location: ParticipantLocationEdit =
      body.address !== undefined
        ? { kind: "replace", address: body.address, fuzzyLocation: body.fuzzyLocation }
        : body.fuzzyLocation !== undefined
          ? { kind: "visibility", fuzzyLocation: body.fuzzyLocation }
          : { kind: "retain" };
    return response(
      participantResponse,
      await meetings.updateParticipant({
        eventId: id,
        credential,
        participantId,
        name: body.name,
        location,
      })
    );
  });
  app.post("/api/events/:id/participants", async (request, reply) => {
    const credential =
      request.headers.authorization === undefined
        ? undefined
        : bearer(request.headers.authorization);
    const { id } = eventParams.parse(request.params);
    const participant = createParticipantBody.parse(request.body);
    if (credential !== undefined) {
      const added = await meetings.addParticipant({ eventId: id, credential, participant });
      return reply.code(201).send(response(participantResponse, added));
    }
    const joined = await meetings.join({ eventId: id, participant });
    return reply.code(201).send(
      response(joinedParticipantResponse, {
        ...joined.participant,
        participantToken: joined.participantToken,
      })
    );
  });
  app.delete("/api/events/:id/participants/:participantId", async (request) => {
    const credential = bearer(request.headers.authorization);
    const { id, participantId } = participantParams.parse(request.params);
    await meetings.removeParticipant({ eventId: id, credential, participantId });
    return { success: true, message: "Participant deleted successfully" };
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
    const session = await accounts.session(requiredSessionCookie(request));
    return response(sessionResponse, { user: userWire(session.user) });
  });
  const cookieOptions = {
    httpOnly: true,
    secure: secureCookies,
    sameSite: "lax",
    path: "/",
  } as const;
  app.post("/api/auth/register", async (request, reply) => {
    const session = await accounts.register(registerBody.parse(request.body));
    reply.setCookie("session_token", session.credential, {
      ...cookieOptions,
      maxAge: session.lifetimeSeconds,
    });
    return reply.code(201).send(response(sessionResponse, { user: userWire(session.user) }));
  });
  app.post("/api/auth/login", async (request, reply) => {
    const session = await accounts.login(loginBody.parse(request.body));
    reply.setCookie("session_token", session.credential, {
      ...cookieOptions,
      maxAge: session.lifetimeSeconds,
    });
    return response(sessionResponse, { user: userWire(session.user) });
  });
  app.post("/api/auth/logout", async (request, reply) => {
    await accounts.logout(request.cookies.session_token);
    reply.setCookie("session_token", "", { ...cookieOptions, maxAge: 0 });
    return { success: true };
  });
  app.get("/api/users/me", async (request) => {
    const { user } = await accounts.session(requiredSessionCookie(request));
    return response(userResponse, userWire(user));
  });
  app.patch("/api/users/me", async (request) => {
    const { user } = await accounts.session(requiredSessionCookie(request));
    const updated = await accounts.updateProfile({
      userId: user.id,
      patch: profileBody.parse(request.body),
    });
    return response(userResponse, userWire(updated));
  });
  app.get("/api/users/me/events", async (request) => {
    const { user } = await accounts.session(requiredSessionCookie(request));
    const events = await meetings.listForAccount(user.id);
    return response(accountEventsResponse, {
      events: events.map((claim) => ({
        ...claim,
        createdAt: claim.createdAt.toISOString(),
        event: {
          ...claim.event,
          meetingTime: claim.event.meetingTime?.toISOString() ?? null,
          publishedAt: claim.event.publishedAt?.toISOString() ?? null,
          createdAt: claim.event.createdAt.toISOString(),
        },
      })),
    });
  });
  app.post("/api/users/me/events/claim", async (request, reply) => {
    const { user } = await accounts.session(requiredSessionCookie(request));
    const body = claimBody.parse(request.body);
    const claim = await meetings.claim({
      userId: user.id,
      eventId: body.eventId,
      credential: body.participantToken,
    });
    return reply
      .code(201)
      .send(response(claimResponse, { success: true, userEvent: claimWire(claim) }));
  });

  const unavailable: [HTTPMethods, string][] = [
    ["GET", "/api/events/:id/mec"],
    ["POST", "/api/events/:id/publish"],
    ["DELETE", "/api/events/:id/publish"],
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
