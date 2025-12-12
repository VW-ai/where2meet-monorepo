# META/MILESTONES - Index

Backend implementation milestones. Complete in order.

---

## Milestones

| # | File | Focus | Key Deliverables |
|---|------|-------|------------------|
| 1 | [MILESTONE_1.md](MILESTONE_1.md) | Foundation | Fastify, Prisma, Redis, project structure |
| 2 | [MILESTONE_2.md](MILESTONE_2.md) | Event Module | Event CRUD, organizer token auth |
| 3 | [MILESTONE_3.md](MILESTONE_3.md) | Maps + Participant | Geocoding, participant CRUD, MEC algorithm |
| 4 | [MILESTONE_4.md](MILESTONE_4.md) | Venue Search | Google Places, search by query/category |
| 5 | [MILESTONE_5.md](MILESTONE_5.md) | Voting | Vote CRUD, aggregation, venue caching |
| 6 | [MILESTONE_6.md](MILESTONE_6.md) | Routes + Publish | Google Directions, publish feature |
| 7 | [MILESTONE_7.md](MILESTONE_7.md) | Production | Rate limiting, error handling, logging |

---

## Dependency Chain

```
M1 → M2 → M3 → M4 → M5 → M6 → M7
```

Each milestone builds on the previous. Do not skip ahead.
