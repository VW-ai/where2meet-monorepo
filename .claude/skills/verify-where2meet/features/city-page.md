# City page

A reader opens a city hub, sees the areas of the city that each have their own page, and picks a post from the city's guides.

## Sub-features

- `city-render` renders heading level 1 for the city.
- `city-towns` links each area in bold, for example `Midtown` and `Union Square`.
- `city-posts` lists the city's posts under `Guides for <city>`.
- `city-cta` renders link `Plan where to meet in <city>`.

## How to get to it (user POV)

- Open `/blog/<city>`, for example `/blog/new-york`.
- Choose a city under `Guides by city` on the home page.
- Choose a city on `/blog`.

## Driving it with drive.mjs

Preconditions:

- Doctor exits 0.

- **Run.** Run `node .claude/skills/verify-where2meet/scripts/drive.mjs city-page`. The flow opens `/blog/new-york`, reads the bold area links, and counts the items in the list after heading `Guides for New York`.
- **Proof.** `result.json` has `status` 200, a `towns` list such as `Midtown`, `Lower Manhattan`, `Union Square` and `Upper West Side`, and `posts` greater than 0. `city.png` shows the page.

## Gotchas

- `next dev` compiles a page on its first request. The flow waits for network idle, so allow the default 60 second timeout.
- The post list grows when the scheduled blog writer merges a post, so assert a count above 0, not an exact count.
