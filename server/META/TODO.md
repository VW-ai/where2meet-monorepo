# TODO TRACKER
This tracker serves as a log of what we need to do in the next iteration of development. sections are separated by time(date granularity). APPEND ONLY.

---

## 2025-12-11

### Milestone 1: Foundation
- [x] Initialize Node.js project with TypeScript
- [x] Configure Fastify
- [x] Setup Prisma with PostgreSQL
- [x] Setup Redis client
- [x] Create project folder structure
- [x] Add health check endpoint
- [x] Add basic error handling
- [x] Configure environment variables

### Milestone 2: Event CRUD (COMPLETED)
- [x] Create Event model service
- [x] POST /api/events - Create event
- [x] GET /api/events/:id - Get event by ID
- [x] PATCH /api/events/:id - Update event (organizer only)
- [x] DELETE /api/events/:id - Delete event (organizer only)
- [x] Add Zod validation schemas
- [x] Write integration tests for Event endpoints

---

## 2025-12-12

### DTO Layer Refactoring (COMPLETED)
- [x] Create `src/dto/` folder with atomic files
- [x] Add Zod schemas for runtime response validation
- [x] Create mappers with `.parse()` validation
- [x] Refactor EventService to return raw entities
- [x] Update routes to use mappers
- [x] Update API spec to match DTOs

### Milestone 3: Maps + Participant (COMPLETED)
- [x] Create Maps service (Google Geocoding API wrapper)
- [x] POST /api/events/:id/participants - Add participant
- [x] PATCH /api/events/:id/participants/:pid - Update participant
- [x] DELETE /api/events/:id/participants/:pid - Remove participant
- [x] Implement MEC (Minimum Enclosing Circle) algorithm
- [x] Add participant color assignment
- [x] Write tests for Participant endpoints
- [x] Implement dual-token auth (organizerToken OR participantToken)

---

## 2025-12-15

### Milestone 4: Venue Search (COMPLETED)
- [x] Create Places API service (`src/lib/places/`)
- [x] POST /api/venues/search - Search venues near MEC center
- [x] GET /api/venues/:id - Get venue details
- [x] Create venue schemas, DTOs, mappers
- [x] Redis caching for Places API responses
- [x] Write unit and integration tests

### Milestone 5: Voting (COMPLETED)
- [x] Add Vote model operations
- [x] POST /api/events/:id/votes - Cast vote
- [x] DELETE /api/events/:id/votes - Remove vote
- [x] GET /api/events/:id/votes - Get voting results
- [x] Create global venue table for caching
- [x] Implement transactional voting with idempotency
- [x] Write 32 voting integration tests

---

## 2025-12-21

### Vote API Refactoring (COMPLETED)
- [x] Fix security bug: organizer can vote on behalf of any participant
- [x] Add `isOrganizer` field to Participant, make location nullable
- [x] Auto-create organizer participant on event creation
- [x] Change vote URLs to `/api/events/:id/participants/:participantId/votes`
- [x] Create `createVerifyParticipantAccess({ selfOnly })` auth hook factory
- [x] Update vote routes to use selfOnly hook
- [x] Update all vote tests for new URL pattern
- [x] Update documentation (API_SPECIFICATION.md, DATABASE_SCHEMA.md)

### Milestone 6: Routes + Publish (COMPLETED)
- [x] Create directions library (`src/lib/directions/`)
- [x] Add DIRECTIONS_* config to config.ts
- [x] Create directions DTOs and mapper
- [x] Create directions service
- [x] Refactor auth hooks (extract verifyEventToken helper)
- [x] Create directions route: GET /api/events/:id/venues/:venueId/directions
- [x] Add publish/unpublish to event repository
- [x] Add publishEvent/unpublishEvent to event service
- [x] Add POST/DELETE /publish routes
- [x] Write unit tests for formatting (22 tests)
- [x] Write integration tests for directions (14 tests)
- [x] Write integration tests for publish (20 tests)
- [x] Update documentation (API_SPECIFICATION, PROGRESS, TODO)

### Future: Milestone 7 - Notifications (Not Started)
- [ ] WebSocket or polling for real-time updates
- [ ] Publish event notifications to participants
- [ ] Vote update notifications

### Future: OpenAPI Documentation (see issue M2_FastifySchemaVsMapperValidation)
- [ ] Evaluate need for auto-generated API docs
- [ ] If needed: migrate to `fastify-type-provider-zod` + `@fastify/swagger`

### Future: Auth Strategy Review (see issue M4_VenueEndpointAuthStrategy)
- [ ] Decide on venue search endpoint authentication
- [ ] Implement auth if needed based on frontend requirements

---

## 2025-12-26

### SSE Vote System Upgrade (COMPLETED)
- [x] Add composite index `@@index([eventId, venueId])` to Vote model
- [x] Create and apply database migration
- [x] Implement Redis sequence tracking functions
- [x] Add unit tests for sequence tracking (9 tests)
- [x] Add `VoteChangedPayload` TypeScript interface
- [x] Enhance `VoteStatisticsPayload` with seq, eventId, updatedAt, voterIds
- [x] Create snapshot endpoint `GET /api/events/:id/votes/statistics`
- [x] Add integration tests for snapshot endpoint (6 tests)
- [x] Modify SSE broadcast to auto-enrich vote events
- [x] Update POST/DELETE votes to broadcast dual events (vote:changed + vote:statistics)
- [x] Add integration tests for vote:changed events (4 tests)
- [x] Verify TypeScript compilation
- [ ] Phase 7: Remove deprecated `voterNames` field (requires frontend migration coordination)

### Future: Milestone 7 - Real-time Notifications (Partially Complete)
- [x] Server-Sent Events (SSE) implementation
- [x] SSE vote event broadcasting
- [x] Sequence-based event ordering
- [x] Reconnection recovery via snapshot endpoint
- [ ] Participant add/update/remove events (if needed)
- [ ] Event update/publish events (if needed)

---

## 2026-09-04

### Railway Deployment Follow-ups
- [x] Fix `startCommand` so Node actually starts on Railway (shell-wrapped, see PROGRESS.md)
- [ ] Confirm first green deploy: healthcheck passes and `/health/ready` returns `ok` or `degraded`
- [ ] Set `REDIS_URL` on Railway (Redis service reference) for caching and cross-replica SSE
- [ ] Add the real frontend origin to `CORS_ORIGINS` before the frontend goes live
- [ ] Update `docs/DEPLOYMENT.md` and `META/ARCHITECTURE/DEPLOYMENT.md`, which still describe `preDeployCommand`
