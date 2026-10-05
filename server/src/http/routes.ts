import type { FastifyInstance, FastifyRequest } from "fastify";
import type {
  Meetings,
  MeetingSnapshot,
  ParticipantLocationEdit,
  AccountClaim,
} from "../modules/meetings/index.js";
import type { Accounts, AccountProfile } from "../modules/accounts/index.js";
import type { Places } from "../modules/places/index.js";
import { directionsWire, photoWire } from "./places.js";
import { AppError } from "../errors.js";
import type { Notifications } from "../runtime/notifications.js";
import { bearer, voteStatisticsWire } from "./sse.js";
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
  castVoteBody,
  castVoteResponse,
  removeVoteParams,
  removeVoteResponse,
  voteStatisticsResponse,
  publishBody,
  sessionResponse,
  userResponse,
  registerBody,
  loginBody,
  profileBody,
  claimBody,
  claimResponse,
  accountEventsResponse,
  venueParams,
  directionsParams,
  directionsQuery,
  searchBody,
  detailsResponse,
  searchResponse,
  directionsResponse,
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
  secureCookies: boolean,
  places: Places,
  publicApiOrigin: () => string,
  notifications: Notifications
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
    const votes = await meetings.votes(id);
    return response(votesResponse, {
      ...votes,
      venues: votes.venues.map((place) => photoWire(place, publicApiOrigin)),
    });
  });
  app.post("/api/events/:id/participants/:participantId/votes", async (request, reply) => {
    const credential = bearer(request.headers.authorization);
    const { id, participantId } = participantParams.parse(request.params);
    const { venueId } = castVoteBody.parse(request.body);
    const voteId = await meetings.castVote({ eventId: id, credential, participantId, venueId });
    return reply.code(201).send(response(castVoteResponse, { success: true, voteId }));
  });
  app.delete("/api/events/:id/participants/:participantId/votes/:venueId", async (request) => {
    const credential = bearer(request.headers.authorization);
    const { id, participantId, venueId } = removeVoteParams.parse(request.params);
    const deleted = await meetings.removeVote({ eventId: id, credential, participantId, venueId });
    return response(removeVoteResponse, { success: true, deleted });
  });
  app.get("/api/events/:id/votes/statistics", async (request) => {
    const { id } = eventParams.parse(request.params);
    const votes = await meetings.voteStatistics(id);
    const seq = await notifications.currentSequence(id);
    return response(voteStatisticsResponse, voteStatisticsWire(id, votes, seq));
  });
  app.post("/api/events/:id/publish", async (request) => {
    const credential = bearer(request.headers.authorization);
    const { id } = eventParams.parse(request.params);
    const { venueId } = publishBody.parse(request.body);
    const meeting = await meetings.publish({ eventId: id, credential, venueId });
    return response(eventResponse, eventWire(meeting));
  });
  app.delete("/api/events/:id/publish", async (request) => {
    const credential = bearer(request.headers.authorization);
    const { id } = eventParams.parse(request.params);
    return response(
      eventResponse,
      eventWire(await meetings.unpublish({ eventId: id, credential }))
    );
  });
  app.post("/api/venues/search", async (request) => {
    const input = searchBody.parse(request.body);
    const result = await places.search(input);
    if (result.kind === "unavailable")
      throw new AppError("EXTERNAL_SERVICE_ERROR", "Venue search is temporarily unavailable");
    return response(searchResponse, {
      venues: result.venues.map((place) => photoWire(place, publicApiOrigin)),
      totalResults: result.venues.length,
      searchCenter: input.center,
    });
  });
  app.get("/api/venues/:id", async (request) => {
    const { id } = venueParams.parse(request.params);
    const result = await places.details(id);
    if (result.kind !== "found")
      throw new AppError("EXTERNAL_SERVICE_ERROR", "Venue details are temporarily unavailable");
    return response(detailsResponse, photoWire(result.value, publicApiOrigin));
  });
  app.get("/api/venues/:id/photo", async (request, reply) => {
    const { id } = venueParams.parse(request.params);
    const result = await places.photo(id);
    reply.header("Cache-Control", "no-store");
    if (result.kind === "not-found") throw new AppError("NOT_FOUND", "Venue photo not found");
    if (result.kind === "unavailable")
      throw new AppError("EXTERNAL_SERVICE_ERROR", "Venue photo is temporarily unavailable");
    return reply.redirect(result.value, 302);
  });
  app.get("/api/events/:id/venues/:venueId/directions", async (request) => {
    const credential = bearer(request.headers.authorization);
    const { id, venueId } = directionsParams.parse(request.params);
    const query = directionsQuery.parse(request.query);
    const result = await meetings.directions({
      eventId: id,
      credential,
      venueId,
      mode: query.travelMode,
      participantId: query.participantId,
    });
    return response(directionsResponse, directionsWire(result));
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

  app.get("/api/events/:id/mec", () => {
    throw new AppError(
      "FEATURE_NOT_AVAILABLE",
      "This operation is not available in this migration stage"
    );
  });
}
