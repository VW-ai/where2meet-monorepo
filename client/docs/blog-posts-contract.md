# Blog posts: what the site reads from the Control Panel (v3) and the repo

The site builds the blog from three sources: the 4 original MDX posts in `src/content/blog/`, agent-written Markdown posts in `src/content/posts/` (see [Repo Markdown posts](#repo-markdown-posts)), and the Control Panel's v3 payload.

The Control Panel owns the v3 contract. Its source of truth is the panel's contract doc in [VW-ai/nomi-control](https://github.com/VW-ai/nomi-control), `docs/where2meet-guides-contract.md`, in its v3 section. This page lists only what the site relies on. If the two disagree, the panel's doc wins and the site changes to match.

Owner decisions (2026-10-08):

- Local guides and blog posts are one thing, "posts", in one section at `/blog`.
- New posts, general and local, are written and published in the panel. The 4 repo posts in `src/content/blog/` stay MDX with their widgets until they move.
- Posts show real, licensed Wikimedia Commons photos, served from this site so search engines index them.
- Byline on every post: "The Where2Meet team". No reader-location detection. A page's place is fixed by its URL.

Owner decisions (2026-10-10):

- Agents write posts as Markdown files in `src/content/posts/` and open a pull request. The owner reviews and merges, and the merge publishes the post.
- Post parameters live in `src/content/taxonomy.yaml`, copied from the panel's seed. Repo posts take their keys and labels from it.

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

- `/blog/<segment>` belongs to an MDX post first, then the photo route (`images`), then a general Markdown post, then a city, then a general panel post.
- `/blog/<city>/<segment>` belongs to a Markdown post in the city first, then a town, then a panel post in the city.
- `/blog/<city>/<town>/<segment>` belongs to a Markdown post in the town first, then a panel post in the town.
- A panel item whose path is already held is dropped with a reason, such as `posts[0]: slug "how-to-pick-a-date-spot" is taken by a repo post`. A panel photo whose `file_name` a repo post lists is dropped the same way.

## Read endpoint

`GET /api/control/where2meet/published/v3` with `Authorization: Bearer <read token>`. `loadCatalog` in `src/features/blog/lib/source.ts` fetches it and caches it for an hour under the tag `where2meet-guides`. It reads `src/content/posts/*.md` and `src/content/taxonomy.yaml` from disk on every load, and `parseCatalog` in `src/features/blog/lib/parse.ts` builds the catalog from all of them.

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

- A panel post's labels come only from the payload's `taxonomy`. A repo Markdown post's come from `src/content/taxonomy.yaml`. A local post shows its occasion and each parameter it sets as chips under the title, in the order occasion, time, venue type, group size, budget. A general post shows no chips.
- Every post, from the repo or the panel, uses one template: the title, the byline with the published and updated dates, the cover with its credit, the body, the place cards, the call to action, and up to 4 related posts. Related posts share the occasion first, then the city or town.
- `images[0]` is the cover. The page shows it at its own size and loads it at once. Every other photo loads lazily.
- A line holding only `![](<file_name>)` places the image with that `file_name` there, with its alt text, caption and credit. A line holding only `:::places` places the place cards. Photos the body doesn't place, other than the cover, and the place cards without a `:::places` line, render after the second `##` section.
- A caption reads "<caption>. Photo by <author> (<license>) via Wikimedia Commons". The license links to its deed, Wikimedia Commons links to `page_url`, and a cropped CC BY photo adds ", cropped".
- A city or town page shows its image, intro, transit notes, every post in it, and, for a city, its towns.
- The canonical URL, the BlogPosting and BreadcrumbList JSON-LD, `sitemap.xml` and `llms.txt` use each page's `/blog` URL. BlogPosting lists each photo as an ImageObject with `contentUrl`, `width`, `height`, `caption`, `creditText`, `creator`, `license` (left out for public domain) and `acquireLicensePage`. The sitemap dates each page by its `updated_at` and lists its photos.
- Text fields use the Markdown subset: paragraphs, `-` and `1.` lists, `**bold**`, `*italic*`, `[text](https://…)` links, and `##` or `###` headings. The site drops raw HTML and shows any link that is not `https://` or a site path as plain text.
- Place photos, ratings and addresses load live from Google by `place_id`. The site stores none of them.

## Repo Markdown posts

To add a post, write one file, `src/content/posts/<slug>.md`, and open a pull request. Don't merge it. The owner reviews and merges, and the merge publishes the post. The site builds the file into the same post a panel post becomes, with the same template, photo route, place cards, sitemap entry, `llms.txt` line and JSON-LD.

### Name the file

The file name is the slug and the last segment of the URL. Use lowercase `[a-z0-9-]+`, keyword first, at most 80 characters. Don't use `images`, a slug in `src/content/blog/posts.ts`, or the name of another file in `src/content/posts/`.

### Write the front matter

The file starts with YAML front matter between two `---` lines. The Markdown body follows. For a full post that passes every check, see `src/features/blog/__fixtures__/posts/group-dinner-after-work.md`.

```markdown
---
title: How to plan a coffee catch-up across town
description: Pick a coffee spot that is quick for both of you to reach, has room to sit and talk, and stays open late enough for a weekday catch-up.
main_keyword: coffee catch-up
occasion: coffee-catch-up
time: weekday-lunch
venue_type: coffee-shop
group_size: two
budget: null
city: null
town: null
published_at: 2026-10-10
updated_at: 2026-10-10
places:
  - place_id: ChIJ...
    label: Think Coffee
    note: A coffee shop about a 2-minute walk from the Union Square station, where eight subway lines stop.
images:
  - file_name: union-square-park-new-york.jpg
    source_url: https://upload.wikimedia.org/wikipedia/commons/thumb/.../1280px-....jpg
    page_url: https://commons.wikimedia.org/wiki/File:...
    width: 1280
    height: 960
    alt: Union Square Park's lawn on a sunny afternoon
    caption: Union Square Park in Manhattan
    author: Jane Doe
    license: CC BY 4.0
    cropped: false
---

The body, in Markdown.
```

| Field                                        | Value                                                                                                                                                                                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`                                      | The h1 and the SEO title. With " \| Where2Meet" it is at most 60 characters.                                                                                                                                            |
| `description`                                | 120 to 155 characters.                                                                                                                                                                                                  |
| `main_keyword`                               | The search phrase the post targets. It appears in the title and in the first two sentences of the body.                                                                                                                 |
| `occasion`                                   | A key from `occasions` in `src/content/taxonomy.yaml`.                                                                                                                                                                  |
| `time`, `venue_type`, `group_size`, `budget` | A key from that file's `times`, `venue_types`, `group_sizes` or `budgets`, or `null`.                                                                                                                                   |
| `city`, `town`                               | Both `null` for a general post at `/blog/<slug>`. For a local post, the slug of a city the panel publishes, and optionally one of its towns. The post is then at `/blog/<city>/<slug>` or `/blog/<city>/<town>/<slug>`. |
| `published_at`, `updated_at`                 | `YYYY-MM-DD`. `updated_at` is on or after `published_at`. Change it only for a real content change.                                                                                                                     |
| `places`                                     | At least 3, each a `place_id`, the Google `label`, and a `note` of at least 12 words in your own words.                                                                                                                 |
| `images`                                     | At least 3 Wikimedia Commons photos. `images[0]` is the cover.                                                                                                                                                          |

Each image has these fields:

- `file_name`: lowercase `[a-z0-9-]+.jpg`, descriptive, and unique across all published content.
- `source_url`: a JPEG on `upload.wikimedia.org` or `thumb.wikimedia.org`, at most 2,000,000 bytes. A 1,280-pixel-wide thumb fits.
- `page_url`: the photo's `https://commons.wikimedia.org/wiki/File:...` page.
- `width` and `height`: the size of `source_url` in pixels.
- `alt`: what the photo shows and where. `caption`: the line under it.
- `author` and `license`: one of `CC0`, `Public domain`, `CC BY 2.0`, `CC BY 3.0` or `CC BY 4.0`. Share-alike is never allowed. There is no `license_url`, because the site links each license itself.
- `cropped`: `true` when the photo is cropped. A CC BY caption then says so.

Don't put photos in the repo. The site fetches `source_url` and serves the photo at `/blog/images/<file_name>`.

Quote a YAML value that contains `: ` or starts with a character YAML treats specially, such as `"Lunch: the plan"`. Dates stay strings.

### Write the body

The body uses the Markdown subset in [How the site uses the fields](#how-the-site-uses-the-fields), plus two whole lines:

- `![](<file_name>)` places that image, with its alt text, caption and credit.
- `:::places` places the place cards.

Photos the body doesn't place, other than the cover, and the cards without a `:::places` line, render after the second `##` section. Follow the writing rules for everything else.

### Run the checks

In `client/`, run `npm test`. To run only the content checks, run `npx vitest run src/content`. CI runs the same tests, so a pull request with a broken post can't merge.

`checkPosts` in `src/features/blog/lib/post-checks.ts` holds every rule. Each problem names the file and the rule, as in `src/content/posts/<slug>.md: word-count: the body has 640 words; a general post needs 700 to 1,000`.

Each rule checks one thing:

| Rule           | What it wants                                                                                                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fields`       | The front matter parses, every field has the right type, and no field is unknown. The site's own parser runs here, so an unknown key in `src/content/taxonomy.yaml` fails as `front matter: unknown venue_type "sushi-bar"`. |
| `slug`         | The slug is not `images` and is not an MDX post's slug.                                                                                                                                                                      |
| `word-count`   | The body has 700 to 1,000 words for a general post, or 400 to 800 for a local post. A link counts its text, not its URL.                                                                                                     |
| `places`       | At least 3 places, and each note has at least 12 words.                                                                                                                                                                      |
| `images`       | At least 3 usable images, every `![](<file_name>)` line names a listed image, and no other repo post uses the same `file_name`.                                                                                              |
| `image-size`   | Each `source_url` answers a HEAD request with 200, `image/jpeg` and a size of at most 2,000,000 bytes.                                                                                                                       |
| `title`        | The title with " \| Where2Meet" is at most 60 characters.                                                                                                                                                                    |
| `description`  | The description is 120 to 155 characters.                                                                                                                                                                                    |
| `main-keyword` | The title and the body's first two sentences say `main_keyword` as whole words. Headings, photo lines and `:::places` are skipped.                                                                                           |
| `headings`     | The body has `## How to do it in Where2Meet` and `## Common questions`.                                                                                                                                                      |
| `wording`      | No word starting with "fair" and no "meet in the middle", in the title, description, body, place notes, alt text or captions.                                                                                                |
| `style`        | No em dash, en dash or curly quote in the same fields.                                                                                                                                                                       |
| `dates`        | `updated_at` is on or after `published_at`.                                                                                                                                                                                  |

The word, sentence and keyword rules match the panel's publish checklist exactly. The panel's other check, that `main_keyword` is on its Keywords list, isn't in the repo yet.

Fix the `fields` problems first. The content rules run once the front matter parses.

The test sends the `image-size` HEAD requests itself. When the network is down, or Wikimedia answers 429 or 5xx, it prints "size not checked" for those photos and passes. Check their sizes yourself before you open the pull request.

CI can't check whether the panel publishes a local post's city and town. If it doesn't, the site drops the post and logs the reason.

### When the site drops a Markdown post

The site drops a Markdown post and logs one line, such as `[blog] Skipped src/content/posts/<slug>.md: city "boston" is not published`, when:

- the front matter is missing, is not valid YAML, or is not a mapping
- `city` or `town` is not a slug, or `town` is set without `city`
- the city or town is not published in the panel
- any field breaks a rule in [What the site drops](#what-the-site-drops), such as an unknown key in `src/content/taxonomy.yaml`
- its path is held by an MDX post or the photo route

A Markdown post wins every other clash. Its path and its photos' file names are held before the panel payload is read. A panel city, town, post or photo on one of them drops instead. The panel's site scan learns repo slugs only at `/blog/<segment>`, so it can't see a local repo post's slug.

### The taxonomy file

`src/content/taxonomy.yaml` has five lists: `occasions`, `times`, `venue_types`, `group_sizes` and `budgets`. Every value has a slug `key` and a `label`. An occasion also lists the `times`, `venue_types` and `group_sizes` that fit it, where an empty list means any. A venue type has a `google_type` from Google's place types, and a budget has a `price_level`. `checkTaxonomy` in `src/features/blog/lib/parse.ts` checks this schema, and `src/content/__tests__/taxonomy.test.ts` fails on any issue. The site itself reads only each key and label, so a typo elsewhere in the file fails CI but never drops a post. It also fails when an MDX post's occasion is not in the file.

## Photos

`GET /blog/images/<file_name>` serves a photo only when `file_name` belongs to an Image in the published content. Any other name is a 404, and the route never fetches a URL it was given.

The route fetches `source_url` with the User-Agent `Where2Meet/1.0 (https://www.where2meet.org/contact; contact@wayvi-ai.com)`, as Wikimedia asks. Next's data cache keeps each successful answer, so the site fetches each photo once. A 429 from Wikimedia is retried twice, 2 and 4 seconds apart. The response carries Wikimedia's content type and `Cache-Control: public, max-age=31536000, immutable`. `next/image` builds the responsive sizes from that URL.

`cover.png` for a panel post, city or town draws `images[0]`, or the area's `image`, with its credit. Without a photo it draws the map. During a build, a failed photo fetch also draws the map, and the cover picks up its photo when it revalidates.

## What the site drops

`parseCatalog` throws when the payload is not v3 JSON: `version` is not `3`, `taxonomy` is not an object, or `posts` or `cities` is not a list. During a build the site then shows the repo posts alone: MDX posts, and general Markdown posts with their labels from `src/content/taxonomy.yaml`. A local Markdown post drops until the panel publishes its city again. On a request the site keeps serving the last good pages.

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
- `CONTROL_PLANE_READ_TOKEN`: the read token. Without it or the URL, the site builds and serves the repo posts alone, as a failed panel fetch does.
- `WHERE2MEET_REVALIDATE_SECRET`: the webhook secret.

For local development, set `CONTROL_PLANE_FIXTURE` to the absolute path of a v3 JSON file, such as `src/features/blog/__fixtures__/published.json`. The site ignores it when `VERCEL_ENV` is `production`.
