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

### Next: Milestone 5 - Voting
- [ ] Add Vote model operations
- [ ] POST /api/events/:id/votes - Cast vote
- [ ] GET /api/events/:id/votes - Get voting results
- [ ] Finalize venue selection
- [ ] Write voting tests

### Future: OpenAPI Documentation (see issue M2_FastifySchemaVsMapperValidation)
- [ ] Evaluate need for auto-generated API docs
- [ ] If needed: migrate to `fastify-type-provider-zod` + `@fastify/swagger`

### Future: Auth Strategy Review (see issue M4_VenueEndpointAuthStrategy)
- [ ] Decide on venue search endpoint authentication
- [ ] Implement auth if needed based on frontend requirements
