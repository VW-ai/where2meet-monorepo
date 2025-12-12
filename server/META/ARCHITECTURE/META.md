# META/ARCHITECTURE - Index

Backend architecture documentation. Read in order for full context.

---

## Files

| File | Purpose |
|------|---------|
| [FUNCTIONAL_MODULES.md](FUNCTIONAL_MODULES.md) | Core modules: Event, Participant, Maps, MEC, Venue, Auth |
| [ABSTRACT_LAYERS.md](ABSTRACT_LAYERS.md) | Layered architecture, security principles, dev checklist |
| [API_SPECIFICATION.md](API_SPECIFICATION.md) | All API endpoints, request/response contracts |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | Tables: Event, Participant, Venue, Vote + constraints |
| [TECH_STACK.md](TECH_STACK.md) | TypeScript, Fastify, Prisma, PostgreSQL, Redis, Zod |

---

## Reading Order

1. **FUNCTIONAL_MODULES** - Understand what each module does
2. **ABSTRACT_LAYERS** - Understand security & layer responsibilities
3. **API_SPECIFICATION** - Reference during implementation
4. **DATABASE_SCHEMA** - Reference for Prisma schema
5. **TECH_STACK** - Quick reference for tooling decisions
