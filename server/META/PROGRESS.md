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

#### 3.4 Participant Service (COMPLETED)
- Created `src/utils/colors.ts` - Color palette utility
  - 16-color predefined palette for map markers
  - `assignColor(usedColors)` - picks first unused, cycles if all used
  - `getColorByIndex(count)` - simple index-based assignment
- Created `tests/utils/colors.test.ts` - 15 unit tests
- Created `src/services/participant.ts` - Business logic service
  - `addParticipant()` - geocode, assign color, create with fuzzy offset
  - `updateParticipant()` - re-geocode on address change, handle fuzzy toggle
  - `deleteParticipant()` - with authorization checks
  - `getParticipant()` - with event/participant ownership validation
  - `applyFuzzyOffset()` - deterministic offset based on name hash (100-800m)
  - Converts maps errors to business errors (AddressNotFoundError, ExternalServiceError)
- Created `tests/services/participant.test.ts` - 18 unit tests

#### 3.5 Participant Routes (COMPLETED)
- Created `src/routes/participants.ts` - API endpoints
  - POST /api/events/:id/participants - Add participant (auth required)
  - PATCH /api/events/:id/participants/:participantId - Update participant (auth required)
  - DELETE /api/events/:id/participants/:participantId - Remove participant (auth required)
- Registered routes in `src/server.ts`
- Created `tests/participants.test.ts` - 17 integration tests
  - Tests add, update, delete operations
  - Auth validation (401 missing, 403 invalid)
  - Input validation (400 missing fields, invalid address)
  - Error cases (404 event/participant not found)

#### Test Summary
- Total tests: 185 passing
  - Unit tests (schema/util): 93 tests
    - `mec.test.ts`: 25 tests
    - `maps.test.ts`: 21 tests
    - `schemas/participant.test.ts`: 21 tests
    - `schemas/event.test.ts`: 21 tests
    - `utils/colors.test.ts`: 15 tests
  - Service tests: 32 tests
    - `services/event.test.ts`: 14 tests
    - `services/participant.test.ts`: 18 tests
  - Integration tests: 39 tests
    - `events.test.ts`: 20 tests
    - `participants.test.ts`: 17 tests
    - `health.test.ts`: 2 tests
  - ID tests: 11 tests

#### 3.6 Participant Self-Registration (COMPLETED)
- Added `tokenHash` column to Participant model (Prisma schema)
- Created `src/utils/token.ts` - secure token generation and verification
  - `generateOrganizerToken()`, `generateParticipantToken()` - 256-bit entropy tokens
  - `hashToken()` - SHA-256 hashing for storage
  - `verifyToken()` - timing-safe comparison to prevent timing attacks
- Created `src/utils/auth.ts` - auth utilities
  - `extractBearerToken()`, `requireBearerToken()` - header extraction
  - `validateEventId()`, `validateParticipantId()` - parameter validation
- Consolidated auth hooks in `src/hooks/auth.ts`:
  - `verifyOrganizerToken({ optional })` - factory function with optional mode
  - `verifyParticipantAccess` - dual-token auth (organizerToken OR participantToken)
- Updated POST /api/events/:id/participants - optional auth for self-registration
  - No auth: Returns `participantToken` for self-management
  - With organizerToken: No token returned (organizer-created)
- Updated PATCH/DELETE to accept either token type
- Added logger redaction for Authorization headers (security)
- Added lightweight `getPublishStatus()` repository method (performance)
- Updated mappers for `CreateParticipantResponse` with optional token
- All 190 tests passing

#### Code Quality Fixes
- Regenerated Prisma migration with correct column names (`organizer_token_hash`, `token_hash`)
- Removed unused `isOrganizerTokenFormat()`, `isParticipantTokenFormat()` validators
- Updated route documentation to reflect dual-token authentication
- Fixed CORS config to allow PATCH/PUT/DELETE methods (was defaulting to GET/HEAD/POST only)

---

## 2025-12-15

### Milestone 4: Venue Search (COMPLETED)

#### 4.1 Google Places API Integration
- Added Places API config to `src/lib/config.ts`:
  - `PLACES_SEARCH_CACHE_TTL_SECONDS` (1 hour), `PLACES_DETAILS_CACHE_TTL_SECONDS` (24 hours)
  - `PLACES_TIMEOUT_MS` (5s default)
- Created `src/lib/places/` folder with atomic modules:
  - `types.ts` - PlaceResult, PlaceDetails, GeoPoint, Google API response types
  - `errors.ts` - PlaceNotFoundError, PlacesApiError, status code handling
  - `cache.ts` - Redis caching with search/details TTL
  - `client.ts` - HTTP client with retry logic (100ms → 400ms → 1600ms)
  - `search.ts` - searchNearbyPlaces, textSearchPlaces, getPlaceDetails, buildPhotoUrl
  - `index.ts` - Public API exports
- Created `tests/unit/places.test.ts` - 31 unit tests
- Moved `src/lib/mec.ts` to `src/utils/mec.ts` (pure algorithm belongs in utils)

#### 4.2 Venue Schemas & DTOs
- Created `src/schemas/venue.ts` - Request validation schemas
  - `SearchVenuesSchema` - eventId, searchRadius, query/categories (at least one required)
  - `GetVenueDetailsSchema` - placeId parameter validation
  - Category enum: cafe, restaurant, bar, park, museum, shopping, entertainment
- Created `src/dto/venue.dto.ts` - Response DTOs
  - `VenueResponseSchema`, `SearchVenuesResponseSchema`, `VenueDetailsResponseSchema`
- Created `src/mappers/venue.mapper.ts` - PlaceResult → VenueResponse transformation
  - `toVenueResponse()`, `toSearchVenuesResponse()`, `toVenueDetailsResponse()`

#### 4.3 Venue Service
- Created `src/services/venue.ts` - Venue business logic
  - `searchVenues()` - Get event, calculate MEC center, search Places API
  - `getVenueDetails()` - Fetch detailed place info
  - Deduplication by placeId, sorting by rating (nulls last)
  - Maps PlacesApiError to ExternalServiceError
- Created `tests/services/venue.test.ts` - 12 unit tests

#### 4.4 Venue Routes
- Created `src/routes/venues.ts` - API endpoints
  - POST /api/venues/search - Search venues near event MEC center (no auth)
  - GET /api/venues/:id - Get venue details (no auth)
- Registered routes in `src/server.ts`
- Created `tests/venues.test.ts` - 9 integration tests
  - Search with query/categories, validation errors, 404 for non-existent event
  - Venue details with photo URL generation

#### Issues Created
- `META/ISSUES/M4_VenueEndpointAuthStrategy_2025-12-14.md` - Auth strategy discussion (GitHub #7)
- `META/ISSUES/M3_RemoveGeocodingAPIForAutocomplete_2025-12-14.md` - Frontend autocomplete removes geocoding need (GitHub #8)

#### Test Summary
- Total tests: 209 passing
  - Places API: 31 tests
  - VenueService: 12 tests
  - Venue integration: 9 tests
  - Previous tests: 157 tests

---

## 2025-12-21

### Milestone 5: Voting System (COMPLETED)

#### 5.1 Global Venue Design Decision
- Chose "Global Venue Table" architecture over "per-event caching"
- Reasoning: Venues are persistent entities shared across events
- Benefits:
  - One venue row = one Google Place ID (deduplication)
  - Cascade delete on Vote only, not Venue
  - 5-day staleness TTL for venue data refresh

#### 5.2 Database Schema Updates
- Created `venue` table (global cache):
  - `id` (Google Place ID, PK)
  - `name`, `address`, `lat`, `lng`, `category`, `rating`, `priceLevel`, `photoUrl`
  - `createdAt`, `updatedAt` (for staleness tracking)
- Created `vote` table (junction table):
  - `id` (UUID)
  - `eventId`, `participantId`, `venueId` (foreign keys)
  - UNIQUE constraint on (`eventId`, `participantId`, `venueId`)
  - CASCADE delete on Event/Participant delete (Venue persists)

#### 5.3 Repository Layer
- Created `src/repositories/venue.ts` - VenueRepository
  - `upsert()`, `findById()`, `isStale()` (5-day TTL check)
- Created `src/repositories/vote.ts` - VoteRepository
  - `create()`, `findByEventId()`, `deleteByEventParticipantVenue()`
  - `hasVoted()`, `getVoteStatistics()` (aggregated by venue)

#### 5.4 Service Layer
- Updated `src/services/venue.ts` - VenueService
  - `getVenueDetails()` bypasses PostgreSQL tier for full field coverage
  - Uses Redis → Google API flow for complete PlaceDetails (phone, website, hours)
  - Background upsert to PostgreSQL for voting cache efficiency
- Created `src/services/vote.ts` - VoteService
  - `castVote()` - Transactional with Prisma `$transaction`:
    1. Verify event exists and not published
    2. Verify participant belongs to event
    3. Upsert venue to global table
    4. Check for existing vote (idempotency)
    5. Create vote if not exists
  - `removeVote()` - Idempotent delete (deleteMany)
  - `getVoteStatistics()` - Aggregated counts per venue

#### 5.5 DTO & Mapper Layer
- Created `src/dto/vote.dto.ts` - Vote response schemas
  - `VoteResponseSchema` (success, voteId)
  - `VenueWithVotesSchema` (venue + voteCount + voters)
  - `VoteStatisticsResponseSchema` (venues[], totalVotes)
  - `VoteRemovalResponseSchema` (success, deleted)
- Created `src/mappers/vote.mapper.ts` - Vote response transformations
  - `toVoteResponse()`, `toVenueWithVotesResponse()`
  - `toVoteStatisticsResponse()`, `toVoteRemovalResponse()`

#### 5.6 Route Layer
- Created `src/routes/votes.ts` - Vote endpoints
  - POST /api/events/:id/votes - Cast vote (requires auth)
  - DELETE /api/events/:id/votes - Remove vote (requires auth)
  - GET /api/events/:id/votes - Get statistics (no auth)
- Dual-token authentication:
  - organizerToken: Can vote/unvote for any participant
  - participantToken: Can only vote/unvote for self

#### 5.7 Infrastructure Fixes
- Fixed rate limiting: Disabled in test environment
  - Root cause: After 22 tests (~100 requests), rate limiter blocked subsequent requests
  - Solution: Skip @fastify/rate-limit registration when `isTest` is true
- Fixed P2002 idempotency handling:
  - PostgreSQL aborts entire transaction after unique constraint violation
  - Solution: Check for existing vote BEFORE attempting create (not catch after)

#### 5.8 Integration Tests
- Created `tests/votes.test.ts` - 32 integration tests
  - POST /votes: 14 tests (cast, duplicate idempotency, auth, validation)
  - DELETE /votes: 8 tests (remove, idempotency, auth)
  - GET /votes: 7 tests (statistics, aggregation, sorting)
  - Global venue/cascade: 3 tests (shared venue, cascade delete behavior)

#### Test Summary
- Total tests: 299 passing
  - Vote integration: 32 tests
  - Previous tests: 267 tests

#### 5.9 Vote API Refactoring (Bug Fix)
- **Issue**: Organizer could vote on behalf of any participant (security bug)
- **Root Cause**: Vote API accepted `participantId` in request body, allowing spoofing
- **Solution**: RESTful URL pattern + selfOnly auth hook

**Schema Changes**:
- Added `isOrganizer` boolean to Participant model (default: false)
- Made `address`, `lat`, `lng` nullable for organizer participants
- Organizer participant auto-created on event creation (no location, excluded from MEC)

**API Changes**:
- POST `/api/events/:id/votes` → POST `/api/events/:id/participants/:participantId/votes`
- DELETE `/api/events/:id/votes` → DELETE `/api/events/:id/participants/:participantId/votes/:venueId`
- Removed `participantId` from request body (now in URL)
- Event creation response now includes `organizerParticipantId`

**Auth Hook Enhancement**:
- Created `createVerifyParticipantAccess({ selfOnly: boolean })` factory function
- When `selfOnly: true`, organizer can only access their own participant record
- Organizer participant has `tokenHash` matching `organizerTokenHash` for auth linkage

**Files Modified**:
- `prisma/schema.prisma` - Added `isOrganizer`, made location nullable
- `src/services/event.ts` - Auto-create organizer participant in transaction
- `src/hooks/auth.ts` - Added `createVerifyParticipantAccess()` factory with selfOnly option
- `src/routes/votes.ts` - New URL pattern, uses selfOnly hook
- `src/dto/event.dto.ts` - Added `organizerParticipantId` to CreateEventResponse
- `src/dto/participant.dto.ts` - Made location nullable, added `isOrganizer`
- `src/mappers/event.mapper.ts` - Handle null location for organizer
- `META/ARCHITECTURE/API_SPECIFICATION.md` - Updated vote routes section
- `META/ARCHITECTURE/DATABASE_SCHEMA.md` - Updated Participant schema

**Tests Updated**: 299 tests passing
- `tests/votes.test.ts` - Updated all URLs and payloads
- `tests/events.test.ts` - Verify organizerParticipantId in response
- `tests/participants.test.ts` - Account for organizer participant in color assignment
