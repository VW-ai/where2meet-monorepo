# Milestone 1: Foundation

Project setup and infrastructure.

**STATUS: COMPLETED** (2025-12-11)

---

## Deliverables

### 1.1 Project Initialization
- [x] Initialize Node.js project with TypeScript
- [x] Configure Fastify with TypeScript support
- [x] Setup ESLint + Prettier
- [x] Configure Vitest for testing

### 1.2 Database Setup
- [x] Prisma schema with all 4 tables (Event, Participant, Venue, Vote)
- [x] PostgreSQL connection configuration
- [x] Initial migration (schema ready, run `npx prisma db push` with live DB)

### 1.3 Redis Setup
- [x] Redis client configuration
- [x] Connection helper with error handling

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
- [x] Health check endpoint: `GET /health`
- [x] Error handling middleware
- [x] Request logging (Pino)
- [x] Environment variable configuration (dotenv)

### 1.6 Fastify Runtime Documentation
- [x] Document Prisma/Redis infrastructure插件与 `decorate` 注入（含 `onClose` 资源释放）
- [x] Document 全局 `setErrorHandler` + `setNotFoundHandler` 输出契约
- [x] Document lifecycle hooks 对应的 cross-cutting concern 映射
- [x] Document 生产级 guardrails（日志脱敏、schema 单一来源、`app.inject` 测试、外部调用并发阀门）

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

- [x] `npm run dev` starts server without errors
- [x] `npm run test` passes (health check test)
- [x] Prisma can connect and migrate
- [x] Redis client connects successfully
