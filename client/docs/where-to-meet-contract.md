# Where2Meet local guides: control plane ↔ site contract (v1)

Owner decisions (2026-10-05):

- URLs on www.where2meet.org:
  - `/where-to-meet` (index of published cities)
  - `/where-to-meet/<city>` (city hub)
  - `/where-to-meet/<city>/<occasion>` (city guide)
  - `/where-to-meet/<city>/<town>` (town hub)
  - `/where-to-meet/<city>/<town>/<occasion>` (town guide)
- One page per place × occasion. First cities: New York, Ann Arbor.
- No reader-location detection. Each page's location is fixed by its URL.
- Byline on every guide: "The Where2Meet team".

## Occasions (fixed list; keys are URL slugs)

`date-night`, `team-meeting`, `group-dinner`, `coffee-catch-up`, `weekend-hangout`, `family-outing`, `team-offsite`, `long-distance-reunion`.
Labels: Date night, Team meeting, Group dinner, Coffee catch-up, Weekend hangout, Family outing, Team offsite, Long-distance reunion.
City and town slugs must be lowercase `[a-z0-9-]+`, unique within their parent, and must NOT equal an occasion key.

## Read endpoint (control plane)

`GET /api/control/where2meet/published`

- Auth: `Authorization: Bearer <WHERE2MEET_READ_TOKEN>` (new hashed machine scope; read-only; this path only).
- Response 200 `application/json`, only PUBLISHED content:

```json
{
  "version": 1,
  "generated_at": "2026-10-05T12:00:00Z",
  "cities": [
    {
      "slug": "new-york",
      "name": "New York",
      "region": "NY",
      "country": "US",
      "center": { "lat": 40.7128, "lng": -74.006 },
      "updated_at": "2026-10-05",
      "seo": { "title": "Where to meet in New York", "description": "…" },
      "intro": "markdown",
      "transit_notes": "markdown",
      "guides": [
        {
          "occasion": "team-meeting",
          "updated_at": "2026-10-05",
          "seo": { "title": "Where to hold a team meeting in New York", "description": "…" },
          "intro": "markdown",
          "tips": "markdown",
          "places": [
            {
              "place_id": "ChIJ…",
              "label": "Editor-written place name",
              "note": "Editor's own note about why it works"
            }
          ]
        }
      ],
      "towns": [
        {
          "slug": "williamsburg",
          "name": "Williamsburg",
          "center": { "lat": 40.7081, "lng": -73.9571 },
          "updated_at": "2026-10-05",
          "seo": { "title": "…", "description": "…" },
          "intro": "markdown",
          "transit_notes": "markdown",
          "guides": ["same shape as city guides"]
        }
      ]
    }
  ]
}
```

Rules:

- A city appears only when published. A town appears only when it and its city are published. A guide appears only when it and its parent are published.
- Markdown subset the site renders: paragraphs, `-` bullet lists, `1.` lists, `**bold**`, `*italic*`, `[text](https://…)` links, `##`/`###` headings. No raw HTML (the site strips it).
- `place_id`s are Google Places IDs (storing IDs is allowed by Google's terms). The editor's `label` may start from Google's place name, prefilled when the place is picked from search, and is saved as the label the operator chose. `note` is the editor's own words. Photos, ratings, addresses and any other Google data are never stored.
- Dates are `YYYY-MM-DD`. `seo.title` ≤ 60 chars, `seo.description` 50–160 chars (validated on publish).

## Revalidation webhook (site)

`POST https://www.where2meet.org/api/revalidate`

- Auth: `Authorization: Bearer <WHERE2MEET_REVALIDATE_SECRET>`.
- Body: `{ "tag": "where2meet-guides" }`. Response 200 `{ "revalidated": true }`; 401 on a bad secret.
- The control plane calls it after every publish, unpublish or edit to published content. A failed call is reported in the panel; it never blocks the save.

## Publish checklist (enforced by the control plane before anything is published)

Guides:

- `intro` ≥ 60 words and `tips` ≥ 150 words, both written for that place.
- At least 3 places, each with a `label` and a `note` of ≥ 12 words.
- SEO title and description within limits.
- Its city (and town) already published or published together.

Cities and towns:

- `intro` ≥ 60 words and `transit_notes` ≥ 20 words.
- SEO title and description within limits.
- At least one of its own guides (city-level guides for a city, the town's guides for a town) already published or published in the same step. The last published guide of a published city or town cannot be unpublished until the city or town is.

All three:

- Brand wording: no published text field (SEO title and description, intro, transit notes, tips, place notes) may contain a word starting with "fair" (`\bfair`, case-insensitive, so "fairly" and "fairness" too) or the phrase "meet in the middle" (case-insensitive). Place labels are names ("Fairway Market") and are not checked. The failing check names each field and the phrase found.

Content rules are checked again whenever published content is saved, so a live page cannot be edited out of compliance.

## Environment

- Control plane (Doppler `nomi/control_runtime`, allowlisted in `deploy/start.py` `RUNTIME_KEYS`):
  - `NOMI_CONTROL_WHERE2MEET_READ_TOKEN_SHA256`
  - `WHERE2MEET_REVALIDATE_URL`
  - `WHERE2MEET_REVALIDATE_SECRET`
  - `WHERE2MEET_PLACES_SERVER_KEY` (Google key without referrer restriction, for the panel's place search)
- Site (Vercel): `CONTROL_PLANE_URL`, `CONTROL_PLANE_READ_TOKEN`, `WHERE2MEET_REVALIDATE_SECRET`.
