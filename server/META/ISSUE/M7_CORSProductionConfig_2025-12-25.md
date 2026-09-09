# Configure CORS for Production

**Date**: 2025-12-25
**Milestone**: 7 (Real-Time Updates)
**Status**: Open
**Type**: Configuration
**Severity**: High
**GitHub Issue**: #24

---

## Issue

CORS in production is currently disabled (`origin: false`), which blocks browser requests from the frontend unless proxied. This will break frontend deployment.

## Current Behavior

```typescript
// src/server.ts:38
await server.register(cors, {
  origin: config.NODE_ENV === "development" ? true : false,
  // ...
});
```

- Development: All origins allowed
- Production: No origins allowed (browser requests blocked)

## Root Cause

No CORS origin allowlist is configured for production. The current implementation is a placeholder that needs environment-driven configuration.

## Proposed Solution

Add environment-driven CORS allowlist.

### Code Change

```typescript
// src/lib/config.ts
const ConfigSchema = z.object({
  // ... existing
  CORS_ORIGINS: z.string().optional(),  // Comma-separated origins
});

// src/server.ts
function getCorsOrigin(config: Config): boolean | string[] {
  if (config.NODE_ENV === 'development') {
    return true;  // Allow all in dev
  }

  if (config.CORS_ORIGINS) {
    return config.CORS_ORIGINS.split(',').map(s => s.trim());
  }

  return false;  // Deny all if not configured
}

await server.register(cors, {
  origin: getCorsOrigin(config),
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
});
```

### Environment Variables

```bash
# .env.production
CORS_ORIGINS=https://app.where2meet.com,https://staging.where2meet.com
```

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/config.ts` | Add `CORS_ORIGINS` config option |
| `src/server.ts` | Update CORS configuration to use allowlist |
| `.env.example` | Document `CORS_ORIGINS` variable |

---

## Expected Behavior

- Production: Only configured origins allowed
- Development: All origins allowed (unchanged)
- Missing `CORS_ORIGINS` in prod: Deny all (fail-safe)

---

## References

- [Server configuration](../../src/server.ts:38)
- [@fastify/cors docs](https://github.com/fastify/fastify-cors)
