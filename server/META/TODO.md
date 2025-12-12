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

### Next: Milestone 2 - Event CRUD
- [ ] Create Event model service
- [ ] POST /api/events - Create event
- [ ] GET /api/events/:id - Get event by ID
- [ ] DELETE /api/events/:id - Delete event (organizer only)
- [ ] Add Zod validation schemas
- [ ] Write unit tests for Event endpoints
