# SSE Redis Error Path Cleanup

**Date**: 2025-12-25
**Milestone**: 7 (Real-Time Updates)
**Status**: Open
**Type**: Code Quality
**Severity**: Low
**GitHub Issue**: #25

---

## Issue

When Redis fails to initialize, the SSE service enters "local-only mode" but leaves the `publisher` and `subscriber` instances set to failed Redis clients. Every subsequent broadcast attempt tries to publish to Redis, fails, and falls back to local-only. This creates noisy logs.

## Current Behavior

```typescript
// src/plugins/sse.ts
async initialize(): Promise<void> {
  try {
    this.publisher = this.redis.duplicate();
    this.subscriber = this.redis.duplicate();
    await this.publisher.connect();
    await this.subscriber.connect();
    // ...
  } catch (error) {
    logger.warn({ err: error }, "Redis unavailable, SSE running in local-only mode");
    // publisher/subscriber still reference failed clients!
  }
}

async broadcast(...): Promise<void> {
  // ...
  if (this.publisher) {  // This is truthy even when Redis failed
    try {
      await this.publisher.publish(...);  // Fails every time
    } catch (error) {
      // Falls back to local, but logs error each time
    }
  }
}
```

**Result**: Every broadcast logs a Redis publish error, even though we already know Redis is unavailable.

## Root Cause

After Redis initialization fails, `this.publisher` and `this.subscriber` are not set to `null`. The broadcast method checks `if (this.publisher)` which is truthy for the failed client instance.

## Proposed Solution

Set `publisher` and `subscriber` to `null` on initialization failure.

### Code Change

```typescript
// src/plugins/sse.ts
async initialize(): Promise<void> {
  try {
    this.publisher = this.redis.duplicate();
    this.subscriber = this.redis.duplicate();
    await this.publisher.connect();
    await this.subscriber.connect();
    // Subscribe to pattern...
    logger.info("SSE service initialized with Redis pub/sub");
  } catch (error) {
    logger.warn({ err: error }, "Redis unavailable, SSE running in local-only mode");
    this.publisher = null;   // ADD: Clear failed publisher
    this.subscriber = null;  // ADD: Clear failed subscriber
  }
}
```

## Files to Modify

| File | Change |
|------|--------|
| `src/plugins/sse.ts` | Set publisher/subscriber to null on init failure |

---

## Expected Behavior

- Redis init fails -> local-only mode, no repeated errors
- Broadcast calls skip Redis publish entirely (no failed attempts)
- Cleaner logs in local-only mode

---

## References

- [SSE plugin](../../src/plugins/sse.ts:27, 40, 60)
