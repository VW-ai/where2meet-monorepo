# Issue: Fastify response schema vs Mapper validation approach

- **Detected on:** 2025-12-12
- **Milestone:** 2 (Event Module)
- **Owner:** TBD

## Summary

Current implementation uses Zod `.parse()` inside mappers for runtime response validation. This provides runtime type safety but does not leverage Fastify's native response schema system. The two approaches are functionally equivalent for validation but differ in ecosystem integration.

**Current approach (Mapper with `.parse()`):**
```typescript
// src/mappers/event.mapper.ts
export function toEventResponse(entity): EventResponse {
  const response = { ... };
  return EventResponseSchema.parse(response);  // Runtime validation here
}
```

**Alternative approach (Fastify response schema):**
```typescript
fastify.post("/api/events", {
  schema: {
    body: CreateEventSchema,
    response: { 201: CreateEventResponseSchema }
  }
}, handler);
```

## Impact

| Aspect | Mapper `.parse()` | Fastify schema |
|--------|-------------------|----------------|
| Runtime validation | ✅ Yes | ✅ Yes |
| OpenAPI/Swagger generation | ❌ Manual | ✅ Automatic |
| Extra field stripping | ❌ No | ✅ Yes |
| Framework portability | ✅ Works anywhere | ❌ Fastify only |
| Validation timing | Handler internal | After handler returns |

**Current decision:** Keep mapper `.parse()` approach. It provides runtime validation without requiring additional Fastify plugins.

**Future consideration:** If OpenAPI documentation generation becomes a requirement, consider migrating to `fastify-type-provider-zod` + `@fastify/swagger`.

## Proposed Resolution

1. **No immediate action required** — current approach is valid and provides runtime validation.
2. **Document the decision** — add note to architecture docs explaining the validation strategy.
3. **Future migration path** — if OpenAPI docs needed:
   - Install `fastify-type-provider-zod` and `@fastify/swagger`
   - Move schemas to route options
   - Remove `.parse()` from mappers (avoid double validation)

## Next Steps

- [ ] Add architecture decision record (ADR) documenting validation strategy
- [ ] Defer Fastify schema migration until OpenAPI documentation is required
- [ ] Keep schemas in `src/dto/` regardless of approach (single source of truth)
