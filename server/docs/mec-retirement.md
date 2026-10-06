# MEC endpoint retirement

`GET /api/events/:id/mec` is no longer registered. Requests use the ordinary 404 response, including when the event exists.

```json
{ "error": { "code": "NOT_FOUND", "message": "Route not found" } }
```

The frontend calculates the minimum enclosing circle from participant coordinates in [the map component](../../client/src/features/meeting/ui/map/index.tsx), using [the local geometry algorithm](../../client/src/shared/lib/mec.ts). It derives the search radius from that circle and sends coordinates to venue search. The tracked frontend has no HTTP caller of the retired endpoint.

Event HTTP responses retain the required `mec: null` compatibility field. Its response schema, frontend type, and verification assertions remain in place. This retirement changes no database schema or frontend geometry behavior.

The integration test checks an existing event's 200 response with `mec: null`, the retired endpoint's 404 response, an unknown route's 404 response, and unchanged database contents. The test definition alone does not establish deployed acceptance.

The repository inventory found only an integration-test caller of the endpoint. External applications, unpublished scripts, and older deployed frontend bundles were not inspected. The change replaces the migration placeholder's 501 response with 404 and retires the legacy endpoint's 200 contract.
