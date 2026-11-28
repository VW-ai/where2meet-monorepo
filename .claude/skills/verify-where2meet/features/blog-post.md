# Blog post

A reader opens a city guide post, reads the picks as place cards, and follows the call to action to plan a meetup.

## Sub-features

- `post-render` renders the title, byline and cover photo.
- `post-cards` renders each pick as a card in region `Our picks in <city>`.
- `post-cta` renders link `Plan this with your group`, which opens the home page.

## How to get to it (user POV)

- Open `/blog/<city>/<post>`, for example `/blog/new-york/where-to-study-with-friends-new-york`.
- Choose a post in the `Guides for <city>` list on a city page.
- Choose a city on `/blog` or under `Guides by city` on the home page, then a post.

## Driving it with drive.mjs

Preconditions:

- Doctor exits 0.

- **Run.** Run `node .claude/skills/verify-where2meet/scripts/drive.mjs blog-post`. The flow opens `/blog/new-york/where-to-study-with-friends-new-york` and counts the list items in region `Our picks in New York`.
- **Proof.** `result.json` has `status` 200, `placeCards` greater than 0, and `ctaHref`. `post.png` shows the cards and the call to action in view.

## Gotchas

- Card photos, ratings and addresses load in the browser from Google Maps. On localhost they stayed gray placeholders at network idle with the Doppler key. The cause is not checked. Judge the cards by their names and text.
- `up.sh` runs `npm run blog-photos`, which downloads cover photos from Wikimedia. Without network access it fails, and `up.sh` stops.
