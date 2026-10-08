# Where2Meet local guides: what the site reads from the Control Panel (v2)

The Control Panel owns this contract. Its source of truth is `docs/where2meet-guides-contract.md` in [VW-ai/nomi-control](https://github.com/VW-ai/nomi-control). This page lists only what the site relies on. If the two disagree, the panel's doc wins and the site changes to match.

Owner decisions (2026-10-08):

- A city or a town can have many guides. A guide has an occasion and optional parameters: time, venue type, group size and budget.
- Each guide has one readable slug in its URL. The country is stored on the city and stays out of the URL.
- The panel suggests guide ideas and prefills drafts. A person writes the intro and tips and publishes. Nothing is published automatically.
- Byline on every guide: "The Where2Meet team". No reader-location detection. A page's location is fixed by its URL.

## URLs

| Path                                   | Page                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------- |
| `/where-to-meet`                       | Index of published cities                                                 |
| `/where-to-meet/<city>`                | City hub                                                                  |
| `/where-to-meet/<city>/<segment>`      | Town hub when a town has that slug, otherwise a city guide, otherwise 404 |
| `/where-to-meet/<city>/<town>/<guide>` | Town guide                                                                |

Every page below the index has a cover at `<page path>/cover.png`. `findPage` in `src/features/guides/lib/catalog.ts` resolves every path. Town slugs and a city's own guide slugs share one namespace, so the panel never publishes both with the same slug. If one arrives anyway, the site keeps the town and drops the guide.

## Read endpoint

`GET /api/control/where2meet/published/v2` with `Authorization: Bearer <read token>`. The site fetches it from `src/features/guides/lib/source.ts`, caches it for an hour under the tag `where2meet-guides`, and parses it with `parsePublished` in `src/features/guides/lib/parse.ts`.

The response holds published content only:

```json
{
  "version": 2,
  "generated_at": "2026-10-08T12:00:00Z",
  "taxonomy": {
    "occasions": [{ "key": "team-welcome", "label": "Team welcome" }],
    "times": [{ "key": "weekday-lunch", "label": "Weekday lunch" }],
    "venue_types": [{ "key": "chinese-restaurant", "label": "Chinese restaurant" }],
    "group_sizes": [{ "key": "large", "label": "Big group, 7 or more" }],
    "budgets": [{ "key": "moderate", "label": "Mid-range" }]
  },
  "cities": [
    {
      "slug": "new-york",
      "name": "New York",
      "region": "NY",
      "country": "US",
      "center": { "lat": 40.7128, "lng": -74.006 },
      "updated_at": "2026-10-08",
      "seo": { "title": "Where to meet in New York", "description": "…" },
      "intro": "markdown",
      "transit_notes": "markdown",
      "guides": [
        {
          "slug": "chinese-restaurants-for-a-team-welcome-lunch",
          "occasion": "team-welcome",
          "time": "weekday-lunch",
          "venue_type": "chinese-restaurant",
          "group_size": "large",
          "budget": null,
          "updated_at": "2026-10-08",
          "seo": { "title": "…", "description": "…" },
          "intro": "markdown",
          "tips": "markdown",
          "places": [{ "place_id": "ChIJ…", "label": "Place name", "note": "Editor's own note" }]
        }
      ],
      "towns": [
        {
          "slug": "midtown",
          "name": "Midtown",
          "center": { "lat": 40.7549, "lng": -73.984 },
          "updated_at": "2026-10-08",
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

The site ignores `generated_at`, `country` and `center`.

## How the site uses the fields

- Labels come only from `taxonomy`. The site keeps no copy of the occasion or parameter lists.
- A guide page shows its occasion and each parameter it sets as chips under the title, in the order occasion, time, venue type, group size, budget.
- A hub lists its guides grouped by occasion. Under each occasion it links the newest blog post written for that occasion, when one exists.
- The canonical URL, the JSON-LD, `sitemap.xml` and `llms.txt` use each guide's slug URL. The breadcrumbs and `llms.txt` name a guide by its `seo.title`. The sitemap dates every page by its `updated_at`.
- Text fields use the Markdown subset: paragraphs, `-` and `1.` lists, `**bold**`, `*italic*`, `[text](https://…)` links, and `##` or `###` headings. The site drops raw HTML and shows any link that is not `https://` or a site path as plain text.
- Place photos, ratings and addresses load live from Google by `place_id`. The site stores none of them.

## What the site drops

`parsePublished` throws when the payload is not v2 JSON: `version` is not `2`, `taxonomy` is not an object, or `cities` is not a list. During a build the site then publishes no guides. On a request it keeps serving the last good pages.

Otherwise the site drops each bad item, keeps its siblings, and logs one line per item, such as `[guides] Skipped cities[0].guides[2]: unknown venue_type "sushi-bar"`. It drops:

- a taxonomy value without a `key` or a `label`, or with a repeated `key`
- a city or town whose slug is not lowercase `[a-z0-9-]+`, or that has no name, a bad `updated_at` (`YYYY-MM-DD`) or no SEO title and description
- a repeated city slug, or a repeated town slug within a city
- a guide whose slug is not lowercase `[a-z0-9-]+` or is longer than 80 characters
- a guide whose `occasion` is missing or not in `taxonomy.occasions`
- a guide whose `time`, `venue_type`, `group_size` or `budget` is neither `null` nor a key in the matching taxonomy list
- a guide with a bad `updated_at` or without an SEO title and description
- a city guide whose slug is a town's slug in the same city
- a repeated guide slug within a city or within a town
- a place without a `place_id` or a `label`, or with a repeated `place_id` within a guide

The panel's publish checklist covers word counts, SEO limits and brand wording. The site does not check them again.

## Revalidation webhook

`POST https://www.where2meet.org/api/revalidate` with `Authorization: Bearer <WHERE2MEET_REVALIDATE_SECRET>` and the body `{ "tag": "where2meet-guides" }`. It answers 200 `{ "revalidated": true }`, 401 for a bad secret, and 400 for any other body. The panel calls it after every publish, unpublish or edit of published content.

## Environment

Set these on Vercel:

- `CONTROL_PLANE_URL`: the panel's origin.
- `CONTROL_PLANE_READ_TOKEN`: the read token. Without it or the URL, the site builds and serves with no guides.
- `WHERE2MEET_REVALIDATE_SECRET`: the webhook secret.

For local development, set `CONTROL_PLANE_FIXTURE` to the absolute path of a v2 JSON file, such as `src/features/guides/__fixtures__/published.json`. The site ignores it when `VERCEL_ENV` is `production`.
