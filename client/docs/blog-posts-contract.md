# Blog posts: what the site reads from the Control Panel (v3)

The Control Panel owns this contract. Its source of truth is the panel's contract doc in [VW-ai/nomi-control](https://github.com/VW-ai/nomi-control), `docs/where2meet-guides-contract.md`, in its v3 section. This page lists only what the site relies on. If the two disagree, the panel's doc wins and the site changes to match.

Owner decisions (2026-10-08):

- Local guides and blog posts are one thing, "posts", in one section at `/blog`.
- New posts, general and local, are written and published in the panel. The 4 repo posts in `src/content/blog/` stay MDX with their widgets until they move.
- Posts show real, licensed Wikimedia Commons photos, served from this site so search engines index them.
- Byline on every post: "The Where2Meet team". No reader-location detection. A page's place is fixed by its URL.

## URLs

| Path                         | Page                                                  |
| ---------------------------- | ----------------------------------------------------- |
| `/blog`                      | Every post, newest first, then the published cities   |
| `/blog/<segment>`            | A repo post, a general post from the panel, or a city |
| `/blog/<city>/<segment>`     | A town, or a post about the whole city                |
| `/blog/<city>/<town>/<post>` | A post in a town                                      |
| `/blog/images/<file_name>`   | A photo from the published content                    |
| `<any page above>/cover.png` | The page's 1200x630 share image                       |

`/where-to-meet` and every path under it redirect permanently (308) to the same path under `/blog`.

`findPage` in `src/features/blog/lib/catalog.ts` resolves every path. The parser keeps every path unique, so resolving a path is a lookup:

- `/blog/<segment>` belongs to a repo post first, then the photo route (`images`), then a city, then a general post.
- `/blog/<city>/<segment>` belongs to a town first, then a post in the city.
- A panel item whose path is already held is dropped with a reason, such as `posts[0]: slug "how-to-pick-a-date-spot" is taken by a repo post`.

## Read endpoint

`GET /api/control/where2meet/published/v3` with `Authorization: Bearer <read token>`. `loadCatalog` in `src/features/blog/lib/source.ts` fetches it, caches it for an hour under the tag `where2meet-guides`, parses it with `parsePublished` in `src/features/blog/lib/parse.ts`, and adds the repo posts.

The response holds published content only:

```json
{
  "version": 3,
  "generated_at": "2026-10-08T12:00:00Z",
  "taxonomy": {
    "occasions": [{ "key": "team-welcome", "label": "Team welcome" }],
    "times": [{ "key": "weekday-lunch", "label": "Weekday lunch" }],
    "venue_types": [{ "key": "chinese-restaurant", "label": "Chinese restaurant" }],
    "group_sizes": [{ "key": "large", "label": "Big group, 7 or more" }],
    "budgets": [{ "key": "moderate", "label": "Mid-range" }]
  },
  "posts": ["Post: a general post at /blog/<slug>"],
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
      "image": "Image or null",
      "posts": ["Post at /blog/new-york/<slug>"],
      "towns": [
        {
          "slug": "midtown",
          "name": "Midtown",
          "center": { "lat": 40.7549, "lng": -73.984 },
          "updated_at": "2026-10-08",
          "seo": { "title": "…", "description": "…" },
          "intro": "markdown",
          "transit_notes": "markdown",
          "image": "Image or null",
          "posts": ["Post at /blog/new-york/midtown/<slug>"]
        }
      ]
    }
  ]
}
```

A Post:

```json
{
  "slug": "chinese-restaurants-for-a-team-welcome-lunch",
  "occasion": "team-welcome",
  "time": "weekday-lunch",
  "venue_type": "chinese-restaurant",
  "group_size": "large",
  "budget": null,
  "main_keyword": "team welcome lunch",
  "published_at": "2026-10-08",
  "updated_at": "2026-10-08",
  "seo": { "title": "…", "description": "…" },
  "body": "markdown",
  "places": [{ "place_id": "ChIJ…", "label": "Place name", "note": "Editor's own note" }],
  "images": ["Image, the cover first"]
}
```

An Image:

```json
{
  "file_name": "bryant-park-lawn-midtown.jpg",
  "source_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/…/1280px-….jpg",
  "page_url": "https://commons.wikimedia.org/wiki/File:…",
  "width": 1280,
  "height": 960,
  "alt": "Bryant Park's lawn and chairs with the Empire State Building behind them",
  "caption": "Bryant Park's lawn in Midtown",
  "author": "Phi",
  "license": "CC0",
  "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
  "cropped": false
}
```

The site ignores `generated_at`, `country`, `center`, `main_keyword` and `license_url`. It links its own URL for each license name, from `LICENSES` in `src/features/blog/lib/photos.ts`.

`src/features/blog/__fixtures__/published.json` is a full v3 payload with real Commons photos: a general post, New York with a post about the whole city, and Midtown with two posts.

## How the site uses the fields

- Labels come only from `taxonomy`. A local post shows its occasion and each parameter it sets as chips under the title, in the order occasion, time, venue type, group size, budget. A general post shows no chips.
- Every post, from the repo or the panel, uses one template: the title, the byline with the published and updated dates, the cover with its credit, the body, the place cards, the call to action, and up to 4 related posts. Related posts share the occasion first, then the city or town.
- `images[0]` is the cover. The page shows it at its own size and loads it at once. Every other photo loads lazily.
- A line holding only `![](<file_name>)` places the image with that `file_name` there, with its alt text, caption and credit. A line holding only `:::places` places the place cards. Photos the body doesn't place, other than the cover, and the place cards without a `:::places` line, render after the second `##` section.
- A caption reads "<caption>. Photo by <author> (<license>) via Wikimedia Commons". The license links to its deed, Wikimedia Commons links to `page_url`, and a cropped CC BY photo adds ", cropped".
- A city or town page shows its image, intro, transit notes, every post in it, and, for a city, its towns.
- The canonical URL, the BlogPosting and BreadcrumbList JSON-LD, `sitemap.xml` and `llms.txt` use each page's `/blog` URL. BlogPosting lists each photo as an ImageObject with `contentUrl`, `width`, `height`, `caption`, `creditText`, `creator`, `license` (left out for public domain) and `acquireLicensePage`. The sitemap dates each page by its `updated_at` and lists its photos.
- Text fields use the Markdown subset: paragraphs, `-` and `1.` lists, `**bold**`, `*italic*`, `[text](https://…)` links, and `##` or `###` headings. The site drops raw HTML and shows any link that is not `https://` or a site path as plain text.
- Place photos, ratings and addresses load live from Google by `place_id`. The site stores none of them.

## Photos

`GET /blog/images/<file_name>` serves a photo only when `file_name` belongs to an Image in the published content. Any other name is a 404, and the route never fetches a URL it was given.

The route fetches `source_url` with the User-Agent `Where2Meet/1.0 (https://www.where2meet.org/contact; contact@wayvi-ai.com)`, as Wikimedia asks. Next's data cache keeps each successful answer, so the site fetches each photo once. A 429 from Wikimedia is retried twice, 2 and 4 seconds apart. The response carries Wikimedia's content type and `Cache-Control: public, max-age=31536000, immutable`. `next/image` builds the responsive sizes from that URL.

`cover.png` for a panel post, city or town draws `images[0]`, or the area's `image`, with its credit. Without a photo it draws the map. During a build, a failed photo fetch also draws the map, and the cover picks up its photo when it revalidates.

## What the site drops

`parsePublished` throws when the payload is not v3 JSON: `version` is not `3`, `taxonomy` is not an object, or `posts` or `cities` is not a list. During a build the site then shows the repo posts alone. On a request it keeps serving the last good pages.

Otherwise the site drops each bad item, keeps its siblings, and logs one line per item, such as `[blog] Skipped cities[0].posts[2]: unknown venue_type "sushi-bar"`. It drops:

- a taxonomy value without a `key` or a `label`, or with a repeated `key`
- a city or town whose slug is not lowercase `[a-z0-9-]+`, or that has no name, a bad `updated_at` (`YYYY-MM-DD`) or no SEO title and description
- a post whose slug is not lowercase `[a-z0-9-]+` or is longer than 80 characters
- a post whose `occasion` is missing or not in `taxonomy.occasions`, or whose `time`, `venue_type`, `group_size` or `budget` is neither `null` nor a key in the matching taxonomy list
- a post with a bad `published_at` or `updated_at`, or without an SEO title and description
- a post with no valid image left for its cover
- a city, town or post whose path is already held, as the URLs section describes
- a place without a `place_id` or a `label`, or with a repeated `place_id` within a post
- an image whose `file_name` is not lowercase `[a-z0-9-]+\.jpg`, or repeats a `file_name` used anywhere earlier in the payload
- an image whose `source_url` is not `https://upload.wikimedia.org/…` or `https://thumb.wikimedia.org/…`, or whose `page_url` is not `https://commons.wikimedia.org/wiki/File:…`
- an image without a positive whole `width` and `height`, an `alt` or an `author`
- an image whose `license` is not `CC0`, `Public domain`, `CC BY 2.0`, `CC BY 3.0` or `CC BY 4.0`. Share-alike licenses are never allowed.

A city or town with a bad `image` keeps its page and shows no photo. The panel's publish checklist covers word counts, the photo count, SEO limits and brand wording. The site does not check them again.

## Revalidation webhook

`POST https://www.where2meet.org/api/revalidate` with `Authorization: Bearer <WHERE2MEET_REVALIDATE_SECRET>` and the body `{ "tag": "where2meet-guides" }`. It answers 200 `{ "revalidated": true }`, 401 for a bad secret, and 400 for any other body. The panel calls it after every publish, unpublish or edit of published content, and new content appears without a deploy.

## Environment

Set these on Vercel:

- `CONTROL_PLANE_URL`: the panel's origin.
- `CONTROL_PLANE_READ_TOKEN`: the read token. Without it or the URL, the site builds and serves the repo posts alone.
- `WHERE2MEET_REVALIDATE_SECRET`: the webhook secret.

For local development, set `CONTROL_PLANE_FIXTURE` to the absolute path of a v3 JSON file, such as `src/features/blog/__fixtures__/published.json`. The site ignores it when `VERCEL_ENV` is `production`.
