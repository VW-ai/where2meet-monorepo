# Blog content: the files the site builds from

Every page under `/blog` comes from files in `client/`. A file merged to `main` is published, because a merge deploys the site. A draft is an open pull request. The Control Panel only views this content. It reads [`/blog/content.json`](#blogcontentjson) and shows the posts, places, keywords and writing rules it finds there.

Owner decisions:

- 2026-10-08. Local guides and blog posts are one thing, "posts", in one section at `/blog`. Posts show real, licensed Wikimedia Commons photos, served from this site so search engines index them. The byline on every post is "The Where2Meet team". The site never detects a reader's location, so a page's place comes from its URL.
- 2026-10-10. Agents write content as files and open a pull request. The owner reviews and merges. The 4 original posts in `src/content/blog/` stay MDX with their widgets.
- 2026-10-10. Every piece of blog content and SEO configuration lives in the repo: posts, places, parameters, keywords and the writing rules. The panel only views them.

## Make a change

Every change is one pull request against `main`. Before you open it, run `npm test` in `client/`. To run only the content checks, run `npx vitest run src/content`. Open the pull request and don't merge it.

| To                       | Change                                                                                                                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add a post               | Write `src/content/posts/<slug>.md`, as in [Posts](#posts). Its `main_keyword` must be in `keywords.yaml`. A local post's city and town must have place files, in `main` or in the same pull request. |
| Update a post            | Edit its file. Change `updated_at` only for a real content change. Never rename the file, because the name is the published URL.                                                                      |
| Add a city or a town     | Write `src/content/places/<city>.md` or `src/content/places/<city>/<town>.md`, as in [Places](#places). A town needs its city's file.                                                                 |
| Update a city or a town  | Edit its file and change `updated_at`. Never rename the file.                                                                                                                                         |
| Add or change a keyword  | Edit `src/content/keywords.yaml`, as in [Keywords](#keywords).                                                                                                                                        |
| Add a parameter          | Add the occasion, time, venue type, group size or budget to `src/content/taxonomy.yaml`, as in [Parameters](#parameters).                                                                             |
| Change the writing rules | Edit `docs/writing-rules.md` only when the owner asks. It holds the owner's text as written.                                                                                                          |
| Remove a page            | Delete its file. The URL then answers 404. Delete a city's towns and local posts with it, or CI fails.                                                                                                |

## Files

| File                                  | Holds                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `src/content/posts/<slug>.md`         | A post written as Markdown                                             |
| `src/content/blog/*.mdx`, `posts.ts`  | The 4 original posts with their widgets                                |
| `src/content/places/<city>.md`        | A city page                                                            |
| `src/content/places/<city>/<town>.md` | A town page                                                            |
| `src/content/taxonomy.yaml`           | The parameters: occasions, times, venue types, group sizes and budgets |
| `src/content/keywords.yaml`           | The target keywords                                                    |
| `docs/writing-rules.md`               | The writing rules, which the panel's Copy prompt inlines               |

`readRepoContent` in `src/features/blog/lib/source.ts` reads the files under `src/content/`, and `parseCatalog` in `src/features/blog/lib/parse.ts` builds the catalog from them. `readWritingRules` reads `docs/writing-rules.md` for `content.json`. The blog reads no environment variables.

## URLs

| Path                         | Page                                      |
| ---------------------------- | ----------------------------------------- |
| `/blog`                      | Every post, newest first, then the cities |
| `/blog/<segment>`            | An MDX post, a city, or a general post    |
| `/blog/<city>/<segment>`     | A town, or a post about the whole city    |
| `/blog/<city>/<town>/<post>` | A post in a town                          |
| `/blog/images/<file_name>`   | A photo that a post or a place lists      |
| `<any page above>/cover.png` | The page's 1200x630 share image           |
| `/blog/content.json`         | The content for the Control Panel         |

`/where-to-meet` and every path under it redirect permanently (308) to the same path under `/blog`.

Every blog page, cover and photo is built when the site deploys. A path the build didn't produce answers 404.

Paths stay unique. When two files claim one path, the first claim in this order keeps it:

- `/blog/<segment>`: the photo route (`images`), then an MDX post, then a city, then a general post.
- `/blog/<city>/<segment>`: a town, then a post about the city.
- `/blog/<city>/<town>/<segment>`: a post in the town.

Places claim before posts because a dropped place takes its towns and posts with it. The file that loses drops, with a reason such as `src/content/posts/new-york.md: slug "new-york" is taken by a city`.

## Posts

A post is one file, `src/content/posts/<slug>.md`. The site builds every post, Markdown or MDX, with one template: the title, the byline with the published and updated dates, the cover with its credit, the body, the place cards, the call to action, and up to 4 related posts. Related posts share the occasion first, then the city or the town.

### Name the file

The file name is the slug and the last segment of the URL. Use lowercase `[a-z0-9-]+`, keyword first, at most 80 characters. Don't use `images`, a slug in `src/content/blog/posts.ts`, a city's slug, or the name of another post file.

### Write the front matter

The file starts with YAML front matter between two `---` lines. The Markdown body follows. For a full example, see `src/features/blog/__fixtures__/posts/group-dinner-after-work.md`, which the check tests run every rule on.

```markdown
---
title: How to pick a coffee meeting spot across town
description: Pick a coffee meeting spot that is quick for both of you to reach, has room to sit and talk, and stays open late enough for a weekday catch-up.
main_keyword: coffee meeting spot
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

A coffee meeting spot works when both of you can reach it in about the same time. ...
```

| Field                                        | Value                                                                                                                                                                                                                 |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`                                      | The h1 and the SEO title. With " \| Where2Meet" it is at most 60 characters.                                                                                                                                          |
| `description`                                | 120 to 155 characters.                                                                                                                                                                                                |
| `main_keyword`                               | A phrase from `src/content/keywords.yaml` that no other post targets. It appears in the title and in the first two sentences of the body.                                                                             |
| `occasion`                                   | A key from `occasions` in `src/content/taxonomy.yaml`.                                                                                                                                                                |
| `time`, `venue_type`, `group_size`, `budget` | A key from that file's `times`, `venue_types`, `group_sizes` or `budgets`, or `null`.                                                                                                                                 |
| `city`, `town`                               | Both `null` for a general post at `/blog/<slug>`. For a local post, the slug of a city with a place file, and optionally one of its towns. The post is then at `/blog/<city>/<slug>` or `/blog/<city>/<town>/<slug>`. |
| `published_at`, `updated_at`                 | `YYYY-MM-DD`. `updated_at` is on or after `published_at`.                                                                                                                                                             |
| `places`                                     | At least 3, each a `place_id`, the Google `label`, and a `note` of at least 12 words in your own words.                                                                                                               |
| `images`                                     | At least 3 Wikimedia Commons photos, as in [Photos](#photos). `images[0]` is the cover.                                                                                                                               |

Quote a YAML value that contains `: ` or starts with a character YAML treats specially, such as `"Lunch: the plan"`. Dates stay strings.

### Write the body

The body is Markdown in the site's subset: paragraphs, `-` and `1.` lists, `**bold**`, `*italic*`, `[text](https://…)` links, and `##` or `###` headings. The site drops raw HTML and shows a link that is not `https://` or a site path as plain text. Two whole lines add more:

- `![](<file_name>)` places that image, with its alt text, caption and credit.
- `:::places` places the place cards.

Photos the body doesn't place, other than the cover, and the place cards without a `:::places` line, render after the second `##` section. A local post shows its occasion and each parameter it sets as chips under the title, in the order occasion, time, venue type, group size, budget. A general post shows no chips.

Follow the [writing rules](writing-rules.md) for everything else. Place photos, ratings and addresses load live from Google by `place_id`, and the site stores none of them.

## Places

A city page is `src/content/places/<city>.md`, at `/blog/<city>`. A town page is `src/content/places/<city>/<town>.md`, at `/blog/<city>/<town>`. The file name is the slug: lowercase `[a-z0-9-]+`. A town needs its city's file.

A place file has YAML front matter, then the body: the intro, a `## Getting around` line, and the transit notes. For a full example that passes every place check, see `src/features/blog/__fixtures__/content/src/content/places/new-york.md`.

```markdown
---
name: New York
region: NY
country: US
center: { lat: 40.7128, lng: -74.006 }
updated_at: 2026-10-10
seo:
  title: Where to meet in New York
  description: Places in New York that work for groups, from team lunches to group dinners, plus how to get around by subway and late at night.
image:
  file_name: midtown-manhattan-skyline-new-york.jpg
  source_url: https://upload.wikimedia.org/wikipedia/commons/thumb/.../1280px-....jpg
  page_url: https://commons.wikimedia.org/wiki/File:...
  width: 1280
  height: 853
  alt: The Midtown Manhattan skyline with the Empire State Building
  caption: Midtown Manhattan from across the East River
  author: Jane Doe
  license: CC BY 2.0
  cropped: false
---

The intro, in Markdown.

## Getting around

The transit notes, in Markdown.
```

| Field               | Value                                                                                |
| ------------------- | ------------------------------------------------------------------------------------ |
| `name`              | The place's name, as in breadcrumbs, cards and chips.                                |
| `region`, `country` | A city only, such as `NY` and `US`. A town file has neither.                         |
| `center`            | The place's center, as `lat` from -90 to 90 and `lng` from -180 to 180.              |
| `updated_at`        | `YYYY-MM-DD`. Change it for a real content change. The sitemap dates the page by it. |
| `seo`               | The page `title`, which is also the h1, and the `description`, with a post's limits. |
| `image`             | One Wikimedia Commons photo of the area, as in [Photos](#photos).                    |

The intro has at least 60 words on what the area is like for meeting up and which neighborhoods people pick. The transit notes have at least 20 words. They name the lines, stations or roads that matter and anything that changes at night or on weekends.

A city page shows its photo, the intro, "Getting around" with the transit notes, every post in the city and its towns, and links to its towns. A town page shows the same for the town, without towns.

## Keywords

`src/content/keywords.yaml` is a list of the target keywords. Each has a `phrase`, an optional `occasion` key from `src/content/taxonomy.yaml`, and an optional `note`:

```yaml
- phrase: where to meet
- phrase: date spot
  occasion: date-night
  note: A shorter form of "where to go on a date"
```

Phrases are unique, ignoring case and spacing. Every Markdown post's `main_keyword` is one of them. To target a phrase that isn't listed, add it in the same pull request. To check that no other post targets it, search `src/content/posts/` for the phrase.

## Parameters

`src/content/taxonomy.yaml` has five lists: `occasions`, `times`, `venue_types`, `group_sizes` and `budgets`. Every value has a slug `key` and a `label`. An occasion also lists the `times`, `venue_types` and `group_sizes` that fit it, where an empty list means any. A venue type has a `google_type` from Google's place types. A budget has a `price_level` from Google's Text Search price levels. Posts take their keys and chip labels from this file. Each MDX post's occasion must be in it.

## Writing rules

`docs/writing-rules.md` is the owner's writing rules, kept exactly as written. Prettier skips it. The panel's Copy prompt inlines it from `content.json`, and the prompt marks it as overriding the prompt wherever the two conflict. [Checks](#checks) enforces the rules a machine can check.

## Photos

Posts and places use Wikimedia Commons photos. Photos are never downloaded into the repo. Each image has these fields:

- `file_name`: lowercase `[a-z0-9-]+.jpg`, descriptive, and unique across all posts and places.
- `source_url`: a JPEG on `upload.wikimedia.org` or `thumb.wikimedia.org`, at most 2,000,000 bytes. A 1,280-pixel-wide thumb fits.
- `page_url`: the photo's `https://commons.wikimedia.org/wiki/File:...` page.
- `width` and `height`: the size of `source_url` in pixels.
- `alt`: what the photo shows and where. `caption`: the line under it.
- `author` and `license`: one of `CC0`, `Public domain`, `CC BY 2.0`, `CC BY 3.0` or `CC BY 4.0`. Share-alike is never allowed. There is no `license_url`, because the site links each license from `LICENSES` in `src/features/blog/lib/photos.ts`.
- `cropped`: `true` when the photo is cropped. A CC BY caption then says so.

A caption reads "<caption>. Photo by <author> (<license>) via Wikimedia Commons". The license links to its deed, Wikimedia Commons links to `page_url`, and a cropped CC BY photo adds ", cropped". A post's cover shows at its own size and loads at once. Every other photo loads lazily.

The build fetches each listed `source_url` once, with the User-Agent `Where2Meet/1.0 (https://www.where2meet.org/contact; contact@wayvi-ai.com)` as Wikimedia asks, and writes it to `/blog/images/<file_name>`. Next's data cache keeps each answer, so a later build reuses it. A 429 from Wikimedia is retried twice, 2 and 4 seconds apart. If a photo still fails, the build fails, and the site keeps serving the previous deploy. The photo is served as `image/jpeg` with `Cache-Control: public, max-age=31536000, immutable`, and `next/image` builds the responsive sizes from it. Any other file name answers 404, and the route never fetches a URL it was given.

`cover.png` for a Markdown post or a place draws `images[0]`, or the place's `image`, with its credit. A place without a photo gets the map. An MDX post's cover draws its photo from `src/content/blog/covers/<slug>.jpg`.

## Checks

`checkContent` in `src/features/blog/lib/checks.ts` holds every rule, and `src/content/__tests__/content.test.ts` runs it on the repo. CI runs the same test, so a pull request with a broken file can't merge. Each problem names the file and the rule, as in `src/content/posts/<slug>.md: word-count: the body has 640 words; a general post needs 700 to 1,000`.

Every file gets the `fields` rule. It fails when the file doesn't parse, when a field is unknown or has the wrong type, or when the site would drop the file or part of it, as [What the site drops](#what-the-site-drops) lists. Fix the `fields` problems first. The other rules run once the site keeps the post or the place.

A post gets these rules:

| Rule           | What it wants                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `word-count`   | 700 to 1,000 words for a general post, or 400 to 800 for a local post. A link counts its text, not its URL.                                                               |
| `places`       | At least 3 places, and each note has at least 12 words.                                                                                                                   |
| `images`       | At least 3 usable images, and every `![](<file_name>)` line names a listed image.                                                                                         |
| `image-size`   | Each `source_url` answers a HEAD request with 200, `image/jpeg` and a size of at most 2,000,000 bytes.                                                                    |
| `title`        | The title with " \| Where2Meet" is at most 60 characters.                                                                                                                 |
| `description`  | The description is 120 to 155 characters.                                                                                                                                 |
| `main-keyword` | `main_keyword` is a phrase in `keywords.yaml`, and the title and the body's first two sentences say it as whole words. Headings, photo lines and `:::places` are skipped. |
| `headings`     | The body has `## How to do it in Where2Meet` and `## Common questions`.                                                                                                   |
| `wording`      | No word starting with "fair" and no "meet in the middle", in the title, description, body, place notes, alt text or captions.                                             |
| `style`        | No em dash, en dash or curly quote in the same fields.                                                                                                                    |
| `dates`        | `updated_at` is on or after `published_at`.                                                                                                                               |

A city or a town gets these rules:

| Rule             | What it wants                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| `intro`          | The intro has at least 60 words.                                                                                    |
| `getting-around` | The body has a `## Getting around` line, and the transit notes after it have at least 20 words.                     |
| `image`          | The page has an image.                                                                                              |
| `image-size`     | As for posts.                                                                                                       |
| `title`          | The SEO title with " \| Where2Meet" is at most 60 characters.                                                       |
| `description`    | The SEO description is 120 to 155 characters.                                                                       |
| `wording`        | As for posts, in the SEO title and description, the intro, the transit notes, and the image's alt text and caption. |
| `style`          | As for posts, in the same fields.                                                                                   |

`src/content/taxonomy.yaml` and `src/content/keywords.yaml` get only `fields`.

The word, sentence and keyword rules match the panel's publish checklist exactly. The test sends the `image-size` HEAD requests itself. When the network is down, or Wikimedia answers 429 or 5xx, it prints "size not checked" for those photos and passes. Check their sizes yourself before you open the pull request.

## What the site drops

The site builds without a file it can't use and logs one line for it, such as `[blog] Skipped src/content/posts/<slug>.md: unknown venue_type "sushi-bar"`. CI fails on the same problem, so a merged file never drops. The site drops:

- a file whose front matter is missing, is not valid YAML, or is not a mapping
- a post or a place whose path is already held, as [URLs](#urls) describes
- a post with a slug longer than 80 characters
- a post whose `occasion` is not in `taxonomy.yaml`, or whose `time`, `venue_type`, `group_size` or `budget` is neither `null` nor a key in the matching list
- a post whose `city` or `town` is not a slug, whose `town` is set without a `city`, or whose city or town has no place file
- a post with a bad `published_at` or `updated_at`, a missing `title` or `description`, or no valid image left for its cover
- a place without a `name`, a valid `center`, an `updated_at` or an SEO title and description, or a city without a `region` or `country`
- a town whose city has no place file, and a place file nested deeper than `<city>/<town>.md`. A town or a local post names the file it is missing, as in `city "boston" has no place file, src/content/places/boston.md`.
- a place in a post without a `place_id` or a `label`, or with a repeated `place_id`
- an image with a bad `file_name`, `source_url`, `page_url`, `width`, `height`, `alt`, `author` or `license`, or a `file_name` another post or place already uses
- a parameter that breaks its schema. An occasion keeps its other keys when one key in its `times`, `venue_types` or `group_sizes` is unknown.
- a keyword that breaks its schema, names an unknown occasion, or repeats an earlier phrase

A place with a bad `image` keeps its page and shows no photo.

## Search data

The canonical URL, the BlogPosting and BreadcrumbList JSON-LD, `sitemap.xml` and `llms.txt` use each page's `/blog` URL. BlogPosting lists each photo as an ImageObject with `contentUrl`, `width`, `height`, `caption`, `creditText`, `creator`, `license` (left out for public domain) and `acquireLicensePage`. The sitemap dates each page by its `updated_at` and lists its photos. `/blog/content.json` is in neither the sitemap nor `llms.txt`.

## /blog/content.json

`GET https://www.where2meet.org/blog/content.json` is what the Control Panel reads. The build writes it once per deploy, from the same catalog the pages use. It answers with `X-Robots-Tag: noindex`.

```json
{
  "version": 1,
  "generated_at": "2026-10-10T12:00:00Z",
  "taxonomy": {
    "occasions": [
      {
        "key": "team-welcome",
        "label": "Team welcome",
        "times": ["weekday-lunch"],
        "venue_types": [],
        "group_sizes": []
      }
    ],
    "times": [{ "key": "weekday-lunch", "label": "Weekday lunch" }],
    "venue_types": [
      {
        "key": "chinese-restaurant",
        "label": "Chinese restaurant",
        "google_type": "chinese_restaurant"
      }
    ],
    "group_sizes": [{ "key": "large", "label": "Big group, 7 or more" }],
    "budgets": [{ "key": "moderate", "label": "Mid-range", "price_level": "PRICE_LEVEL_MODERATE" }]
  },
  "keywords": [{ "phrase": "date spot", "occasion": "date-night", "note": null }],
  "places": [
    {
      "path": "/blog/new-york",
      "kind": "city",
      "slug": "new-york",
      "name": "New York",
      "center": { "lat": 40.7128, "lng": -74.006 }
    },
    {
      "path": "/blog/new-york/midtown",
      "kind": "town",
      "slug": "midtown",
      "city": "new-york",
      "name": "Midtown",
      "center": { "lat": 40.7549, "lng": -73.984 }
    }
  ],
  "posts": [
    {
      "path": "/blog/how-to-pick-a-date-spot",
      "title": "How to pick a date spot you can both reach",
      "source": "mdx",
      "occasion": "date-night",
      "time": null,
      "venue_type": null,
      "group_size": null,
      "budget": null,
      "main_keyword": null,
      "city": null,
      "town": null,
      "published_at": "2026-10-08",
      "updated_at": "2026-10-08"
    }
  ],
  "writing_rules": "the full text of docs/writing-rules.md"
}
```

- `generated_at` is the build time, in UTC to the second.
- `taxonomy` and `keywords` hold every value the site kept, in file order. A missing `occasion` or `note` is `null`.
- `places` lists each city by file name, then its towns.
- `posts` lists every post, newest first, as `/blog` does. `source` is `mdx` for the 4 original posts, whose parameters, `main_keyword`, `city` and `town` are `null`, and `markdown` for the files in `src/content/posts/`.
- `writing_rules` is the text of `docs/writing-rules.md`, byte for byte.

`buildContentJson` in `src/features/blog/lib/content-json.ts` builds it.
