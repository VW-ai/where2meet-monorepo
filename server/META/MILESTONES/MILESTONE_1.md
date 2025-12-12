# Milestone 1: Foundation

Project setup and infrastructure.

---

## Deliverables

### 1.1 Project Initialization
- [ ] Initialize Node.js project with TypeScript
- [ ] Configure Fastify with TypeScript support
- [ ] Setup ESLint + Prettier
- [ ] Configure Vitest for testing

### 1.2 Database Setup
- [ ] Prisma schema with all 4 tables (Event, Participant, Venue, Vote)
- [ ] PostgreSQL connection configuration
- [ ] Initial migration

### 1.3 Redis Setup
- [ ] Redis client configuration
- [ ] Connection helper with error handling

### 1.4 Project Structure
```
src/
├── routes/
├── services/
├── repositories/
├── lib/
├── utils/
├── types/
└── index.ts
```

### 1.5 Basic Infrastructure
- [ ] Health check endpoint: `GET /health`
- [ ] Error handling middleware
- [ ] Request logging (Pino)
- [ ] Environment variable configuration (dotenv)

---

## Testing

| Test | Command | Expected |
|------|---------|----------|
| Server starts | `npm run dev` | No errors, listening on port |
| Health check | `curl localhost:3000/health` | `{ "status": "ok" }` |
| DB connection | `npx prisma db push` | Tables created |
| Redis connection | Server logs | "Redis connected" |

---

## Dependencies

- None (this is the first milestone)

---

## Exit Criteria

- [ ] `npm run dev` starts server without errors
- [ ] `npm run test` passes (health check test)
- [ ] Prisma can connect and migrate
- [ ] Redis client connects successfully
