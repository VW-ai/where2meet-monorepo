# PROGRESS TRACKER
This tracker serves as a log of what we have accomplished. sections are separated by time(date granularity). APPEND ONLY.

---

## 2025-12-11

### Documentation Setup
- Created META/CORE/META.md index
- Created META/ARCHITECTURE/META.md index
- Created META/MILESTONES/ with 7 milestone files
- Created CLAUDE.md development guide

### Milestone 1: Foundation (COMPLETED)
- Initialized Node.js project with TypeScript (ES modules)
- Configured Fastify with TypeScript support
- Setup ESLint + Prettier with strict TypeScript rules
- Configured Vitest for testing with setup file
- Created project folder structure (routes, services, repositories, lib, utils, types)
- Setup Prisma with PostgreSQL - created schema with 4 tables (Event, Participant, Venue, Vote)
- Configured Redis client with error handling and reconnection logic
- Implemented health check endpoints (GET /health, GET /health/ready)
- Added global error handling middleware with standardized error responses
- Configured Pino logging with pretty printing for development
- Configured environment variables with Zod validation
- Added JSDoc/TSDoc ESLint plugin for documentation linting
- Created .gitignore and .env.example files
- All tests passing, lint passing

---

## 2025-12-12

### Milestone 2: Event Module (COMPLETED)
- Created DB plugin (`src/plugins/db.ts`) - decorates Fastify with Prisma client
- Created Zod schemas (`src/schemas/event.ts`) using Zod v4 syntax
- Created Event repository (`src/repositories/event.ts`) - CRUD operations
- Created Event service (`src/services/event.ts`) - business logic with token generation
- Created Auth hook (`src/hooks/auth.ts`) - organizerToken verification
- Created Event routes (`src/routes/events.ts`):
  - POST /api/events - Create event (returns organizerToken)
  - GET /api/events/:id - Get event details (no organizerToken)
  - PATCH /api/events/:id - Update event (requires auth)
  - DELETE /api/events/:id - Delete event (requires auth)
- Registered plugins and routes in server.ts
- Created integration tests (`tests/events.test.ts`) - 22 test cases
- Created docker-compose.test.yml for test database
- TypeScript compiles, ESLint passes

### DTO Layer Refactoring
- Created `src/dto/` folder with atomic DTO files:
  - `common.dto.ts` - LocationResponse, DeleteSuccessResponse, helper functions
  - `participant.dto.ts` - ParticipantResponse
  - `event.dto.ts` - EventResponse, CreateEventResponse, MECResponse, EventSettingsResponse
  - `index.ts` - Barrel exports
- Added Zod schemas for runtime response validation (types derived from schemas)
- Created `src/mappers/event.mapper.ts` - entity-to-DTO transformation with `.parse()` validation
- Refactored EventService to return raw entities (transformation in route layer)
- Updated routes to use mappers and `createDeleteSuccessResponse()` helper
- Cleaned up `src/schemas/event.ts` - now only contains request DTOs
- Updated API specification - removed phantom `organizerId` field
- Created issue: M2_FastifySchemaVsMapperValidation_2025-12-12.md

---

## 2025-12-13

### Milestone 3: Maps + Participant Module (IN PROGRESS)

#### 3.1 MEC Algorithm (COMPLETED)
- Created `src/lib/mec.ts` - Minimum Enclosing Circle implementation
  - Welzl's randomized algorithm for O(n) expected time
  - Haversine formula for geographic distance calculations
  - Equirectangular projection for lat/lng to Cartesian conversion
  - Exports: `calculateMEC()`, `haversineDistance()`, `geographicMidpoint()`, `geographicCentroid()`
- Created `tests/unit/mec.test.ts` - 25 unit tests
  - Edge cases: 0, 1, 2, 3+ points
  - Real-world coordinates (NYC, Brazil cities)
  - Tolerance handling for projection errors at large distances

#### 3.2 Maps Service (COMPLETED)
- Added Google Maps config to `src/lib/config.ts`:
  - `GOOGLE_MAPS_API_KEY`, `GEOCODE_CACHE_TTL_SECONDS` (30 days), `GEOCODE_TIMEOUT_MS` (5s)
- Created `src/lib/maps.ts` - Google Geocoding service
  - `geocode(address)` → `{ lat, lng, formattedAddress }`
  - Redis caching with normalized cache keys
  - Retry with exponential backoff (100ms → 400ms → 1600ms)
  - Custom errors: `AddressNotFoundError`, `GeocodingApiError`
  - `isMapsConfigured()` health check
- Created `tests/unit/maps.test.ts` - 21 unit tests
  - Cache hit/miss, API responses, retry logic, error handling
- Created issue: M4_ExtendMapsServiceWithPlacesAPI_2025-12-13.md (for future Places API)

#### 3.3 Participant Repository (COMPLETED)
- Created `src/schemas/participant.ts` - Request validation schemas
  - `CreateParticipantSchema` (name, address, fuzzyLocation)
  - `UpdateParticipantSchema` (partial update with refinement)
  - `ParticipantIdSchema` (UUID validation)
- Created `src/repositories/participant.ts` - Database operations
  - `create()`, `findById()`, `findByEventId()`, `update()`, `delete()`
  - `getUsedColors()` for color assignment support
  - `belongsToEvent()` for authorization checks
- Created `tests/schemas/participant.test.ts` - 21 unit tests
- Created `tests/schemas/event.test.ts` - 21 unit tests (for consistency)

#### Test Summary
- Total unit tests: 88 passing
  - `mec.test.ts`: 25 tests
  - `maps.test.ts`: 21 tests
  - `participant.test.ts`: 21 tests
  - `event.test.ts`: 21 tests
