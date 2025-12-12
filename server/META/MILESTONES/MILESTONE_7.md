# Milestone 7: Production Hardening

Security, reliability, and observability improvements.

---

## Deliverables

### 7.1 Rate Limiting
- [ ] Global: 100 requests / 15 min / IP
- [ ] Event creation: 10 / hour / IP
- [ ] Google API proxies: 30 / min / IP
- [ ] Use @fastify/rate-limit + Redis store

### 7.2 Error Handling
- [ ] Standardized error response format
- [ ] Error codes for all failure cases
- [ ] Sanitize error messages (no stack traces to client)
- [ ] Graceful handling of external service failures

### 7.3 Input Validation Hardening
- [ ] Strict mode on all Zod schemas (reject extra fields)
- [ ] Trim all string inputs
- [ ] Validate coordinate ranges (-90~90, -180~180)
- [ ] Sanitize for XSS in text fields

### 7.4 Logging & Monitoring
- [ ] Structured logging with Pino
- [ ] Request ID in all logs
- [ ] Log external API calls (success/failure/latency)
- [ ] Health check includes DB + Redis status

### 7.5 Caching Strategy
- [ ] Geocode: 30 day TTL
- [ ] Places search: 1 hour TTL
- [ ] Place details: 24 hour TTL
- [ ] Directions: 1 hour TTL
- [ ] Cache miss handling (graceful fallback)

### 7.6 Security
- [ ] CORS configuration
- [ ] Helmet for security headers
- [ ] API key not exposed to frontend
- [ ] organizerToken secure generation (crypto.randomBytes)

### 7.7 Testing Coverage
- [ ] Unit tests for all services
- [ ] Integration tests for all endpoints
- [ ] Edge case tests (empty data, max limits)
- [ ] External service mock tests

---

## Error Response Format

```json
{
  "error": {
    "code": "EVENT_NOT_FOUND",
    "message": "The requested event does not exist"
  }
}
```

### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| VALIDATION_ERROR | 400 | Invalid input |
| ADDRESS_NOT_FOUND | 400 | Geocoding failed |
| UNAUTHORIZED | 401 | Missing/invalid token |
| FORBIDDEN | 403 | No permission |
| NOT_FOUND | 404 | Resource not found |
| EVENT_NOT_FOUND | 404 | Event doesn't exist |
| PARTICIPANT_NOT_FOUND | 404 | Participant doesn't exist |
| CONFLICT | 409 | State conflict |
| EVENT_ALREADY_PUBLISHED | 409 | Cannot modify published event |
| RATE_LIMITED | 429 | Too many requests |
| EXTERNAL_SERVICE_ERROR | 502 | Google API failure |
| INTERNAL_ERROR | 500 | Unexpected error |

---

## Testing

| Test | Method | Expected |
|------|--------|----------|
| Rate limit exceeded | Spam requests | 429 after limit |
| Invalid JSON body | POST with malformed JSON | 400 |
| Extra fields in body | POST with extra fields | 400 (strict mode) |
| DB down | Kill DB, make request | 500 with proper error |
| Redis down | Kill Redis, make request | Graceful degradation |
| Health check | GET /health | DB + Redis status |

---

## Dependencies

- Milestones 1-6 complete

---

## Exit Criteria

- [ ] Rate limiting active on all endpoints
- [ ] All errors return standardized format
- [ ] No sensitive data in error responses
- [ ] Logs include request ID for tracing
- [ ] External service failures handled gracefully
- [ ] >80% test coverage
- [ ] Security headers configured
- [ ] Ready for deployment
