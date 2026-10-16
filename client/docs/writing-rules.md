# Where2Meet writing rules

These rules apply to every post on www.where2meet.org/blog. Every post is a guide for planning where a group meets.
- A **general post** covers one occasion anywhere, at `/blog/<slug>`.
- A **local post** covers one occasion in one place, at `/blog/<city>/<slug>` or `/blog/<city>/<town>/<slug>`, under its city and town pages.

New posts are always local posts, at `/blog/<city>/<slug>` or `/blog/<city>/<town>/<slug>`, under a city or town that has a place file. The four original posts are local posts too, under New York towns.

These rules change only when the owner asks, by pull request to this file, `client/docs/writing-rules.md` in the monorepo. Every writer, a person or an agent, reads them before drafting anything.

## Positioning

- Where2Meet is a place where a group plans where to meet together. Write about planning together, not about finding a midpoint.
- Say "convenient". Never say "fair", "fairly" or "fairness", and never say "meet in the middle". CI blocks these words.
- Byline: The Where2Meet team.

## What we publish

- Every post covers one occasion listed in `client/src/content/taxonomy.yaml`. A post may also have a time, a venue type, a group size and a budget from the same file.
- Most of every post is practical advice that helps a reader even if they never open Where2Meet.
- Every post gives advice of its own. Don't reuse another post's text with the occasion or the place swapped. Near-copies look templated to Google and hurt the whole site.
- We never guess the reader's location. A general post names its example city. A local post's URL fixes its place.
- **General posts** give the advice that works anywhere, in 700 to 1,000 words.
- **Local posts** give the local answer, in 400 to 800 words. That means which stations, streets and places work for that occasion there. They link to the general post for the same occasion, when there is one, instead of repeating it.
- No motion widgets or drawn diagrams. Real photos explain the place better, and search engines can index them.

## Structure

Every post:

1. **The answer first.** The first two sentences answer the search directly and use the main keyword. The rest of the opening paragraph names the reader's situation in their words. A second short paragraph says what the post covers.
2. **Question headings.** Four to five `##` sections in sentence case. Phrase each heading the way people ask it, as in "How far should everyone travel?". Open each section with a one- or two-sentence answer, then the detail.
3. **Real places.** A local post suggests six to eight real places near the top of the post. The places fit the post's title. When the post has a venue type, they are that type. Otherwise they can be any kind of place that suits the occasion, such as restaurants, cafes, bars, museums or parks. The place cards are the list of picks, placed with a `:::places` line right after the first section's answer. Each card's note says why the place fits the occasion, as in Place notes. The line right after `:::places` names where the cards' facts come from. The body doesn't repeat a card. A general post uses at least six examples in one named city.
4. **Real photos.** A cover photo plus at least two photos in the body. See Pictures.
5. **"How to do it in Where2Meet."** Numbered steps, starting from the matching chip on the homepage. When the homepage has no chip for the occasion, start by typing its name in the first box.
6. **"Common questions."** Three to five questions people search, each answered in two or three sentences. Use real questions from Search Console or the Keywords list when you have them.
7. **"A quick checklist."** Plain bullets for general posts. No checkboxes.

City and town pages come from the place files `client/src/content/places/<city>.md` and `client/src/content/places/<city>/<town>.md`. Each page has:
- An intro of at least 60 words on what the area is like for meeting up and which neighborhoods people usually pick.
- Transit notes of at least 20 words that name the lines, stations or roads that matter, and anything that changes at night or on weekends.
- A real photo of the area.
- Links to every published post there.

Text uses the site's Markdown subset: paragraphs, lists, bold, italic, links, and `##` or `###` headings. No raw HTML.

## Pictures

- **Real photos only.** Every post shows real photos of real places it names or of the area it covers. No stock photos, drawings, screenshots of maps or AI images.
- **Google's photos stay live.** Place cards load Google's photo, rating and address live, with credits. Google's terms forbid saving them or putting them in a saved image. So Google photos never count as the post's photos and are never the cover.
- **The post's own photos come from Wikimedia Commons.** Only CC0, public domain or CC BY qualify. Share-alike (CC BY-SA) doesn't, because the cover might then have to carry that license too. Check the license and the author on each photo's Commons page.
- **Merging approves a photo.** The writer lists each photo in the post file by its Commons link. The owner reviews the photos in the pull request, and the merge is the approval to use them.
- **Alt text.** Describe what the photo shows and where, in plain words, as in "Bryant Park's lawn and chairs with the Empire State Building behind them". Include a keyword only when it truly describes the photo. Never stuff keywords.
- **Caption.** Under each photo, say what it shows and credit the photographer and the license, with links. CC BY photos also say "cropped" when cropped.
- **File names.** Use descriptive words joined by hyphens, as in `bryant-park-lawn-midtown.jpg`. Never `IMG_1234.jpg`.
- **Placement.** Put each photo next to the text about that place, not in a gallery at the end.
- **The cover** is the image people see when a page is shared. It's the post's best photo of a named place, credited on the image and under it.
- **Size.** Use the Commons thumbnail 1,280 pixels wide as each photo's `source_url`. The site serves photos from our own domain with width and height set, in modern formats, lazy-loaded below the fold.

## Places

- Pick each place on Google Maps and store only its place ID.
- The label is the place's name. The note is in our own words, at least 12 words, as in Place notes.
- The place cards are the list of picks. The body may name a place where the advice needs it, but it doesn't repeat a card's note.
- Check every fact in a note on Google Maps, and check that each place is open, before publishing. Check again whenever you update the post.
- Times and distances come from Google Maps for a stated mode, as in "about a 5-minute walk".

## Place notes

The card already shows the place's name, photo, rating and address. The note tells the reader why this place suits this plan.

- **Why it fits.** Open with why the place fits the post's occasion and group, in specific terms. "Keep this coffee shop for a check-in of two or three, because it isn't good for groups" says why. "A coffee shop on West 38th Street" only restates the card.
- **One planning detail.** Give the reader something to act on: book ahead or walk in, which station or exit, the group size it suits, or when it closes.
- **Plain facts.** State what you checked as plain facts: takes reservations, good for groups, price level, hours, and the walk from the station.
- **One source line.** Name the source once per post, in one plain sentence on the line right after `:::places`, as in "The hours, reservations, price levels and walk times on these cards come from Google Maps as of October 2026."
- **No source tags in notes.** Never write "per Google", "Google lists", "according to Google" or anything else that names Google in a note. CI blocks it. When a Google office is a landmark, name it another way, as in "near the Chelsea Market building".
- **No shared template.** Vary how notes open and how their sentences run. At most two notes in a post start with the same word, and "A" and "An" count as one word. CI blocks more.
- **Never invent first-hand experience.** Don't claim a visit, a taste, the staff's manner or a room's atmosphere that you can't source. No "we loved".
- **Visits only when real and specific.** Mention a visit only when someone on the team really made it, and say when and what they saw.

Before, in the old template: "A coffee shop on West 38th Street for a quick check-in of two or three, since Google lists it as not good for groups. Google also lists it as inexpensive. About a 5-minute walk from the 42 St-Bryant Pk station."

After: "Keep this coffee shop on West 38th Street for a check-in of two or three, because it isn't good for groups. It's inexpensive and about a 5-minute walk from the 42 St-Bryant Pk station."

## Facts and honesty

- Only describe features the app has today:
  - a shared link with no account needed
  - everyone adds where they're coming from, or the organizer adds them
  - an approximate area instead of an exact address
  - searching places around the group or by name
  - travel time by car, transit, walking and bike
  - routes on the map
  - voting
  - the organizer picks the final spot
  - live updates without a refresh
- No invented statistics, reviews, testimonials, quotes or user stories.
- Don't call a place quiet, cheap or popular unless Google Maps or the place itself says so.
- An illustrative example is fine when it is labeled as an example.
- Link the source for any fact a reader might doubt, such as a transit agency's schedule page.

## Style

- Short declarative sentences, one idea each.
- No em dashes or en dashes. Use a period or a comma.
- No colon joining two halves of a sentence. A colon before a list is fine.
- Straight quotes and apostrophes only.
- Plain words, not "utilize", "leverage", "delve", "crucial", "seamless" or "game-changer".
- Active voice. Name who does what.
- Say what something does, not how it feels.
- A bold lead-in is fine only when it is followed by new detail, as in "**The longest trip.** If one person faces an hour each way…".
- No emoji, no hype, no exclamation marks.

## SEO

Search intent and keywords:
- **One main keyword per post.** Before writing, pick one main keyword and up to two related ones from `client/src/content/keywords.yaml`, which the panel's Keywords view also shows. If no listed keyword fits, add one to that file in the same pull request and say why in the pull request description.
- **One post per keyword.** Check that no other post already targets the same main keyword. The Copy prompt lists the posts that already target each keyword. To check by hand, search the `main_keyword` lines in `client/src/content/posts/`. Two posts chasing one keyword compete with each other. Improve the existing post instead.
- **Match the intent.** "How to" searches get steps. "Where to" searches get places. "Ideas" searches get a list.
- **Where the main keyword goes:**
  - in the title
  - in the description
  - in the first two sentences
  - in one `##` heading
  - in the alt text of one photo where it truly describes it

  Use the words as people type them. Write naturally and never repeat a keyword to hit a count.

The page:
- **Title.** The search phrase comes first, as in "How to choose a team meeting location" or "Where to hold a team meeting in Midtown". It's at most 60 characters including " | Where2Meet", so about 47 for the title itself.
- **Description.** 120 to 155 characters, with the main keyword, written as a promise of what the reader gets. Google cuts longer ones.
- **Slug.** Lowercase words joined by hyphens, keyword first, without filler words like "the" or "a". Never change a published slug.
- **Headings.** One h1, which is the title and is added by the page. Then `##` sections, and `###` only inside a section.

Answers that get picked up:
- **Snippets.** Answer-first sections, numbered steps, short lists and the Common questions section are what Google shows in snippets and "People also ask", and what AI answers quote.
- **Specifics.** Use plain facts with numbers and named places, such as "about a 5-minute walk from the Fulton St station, where eight lines stop". Vague claims don't get quoted.

Links:
- **Internal links.**
  - Every post links to two to four related posts.
  - A local post links to its city or town page and to the general post for its occasion, when there is one.
  - A general post links to the local posts for its occasion.
  - Every post links to the homepage step it describes.
  - Use descriptive link text, never "click here".
- **External links.** Link to official sources for facts, such as a transit agency or a venue's own site.

Trust and freshness:
- **Trust.** Every post shows the byline, the published date and the updated date. Facts are checked, and photos are credited. These signal experience and trust to Google.
- **Freshness.** Change the updated date only for a real content change. Recheck every local post's places every six months.
- **Search Console.** Request indexing for a new URL after publishing. If a post gets impressions but few clicks, rewrite its title and description first.

What the site handles, so don't hand-write it:
- canonical URLs
- the sitemap with photo entries
- `llms.txt`
- BlogPosting, breadcrumb and image structured data (with each photo's license and credit)
- the Open Graph cover

## Publishing

- **One way to publish.** A person or an agent writes the post as `client/src/content/posts/<slug>.md` in the monorepo, in the format in `client/docs/blog-posts-contract.md`. They run `npm test` in `client/` and open a pull request. The writer never merges. The owner reviews and merges, and the merge deploys the post.
- **Starting from an idea.** The panel's Ideas view has a Copy prompt button. It copies a prompt for an agent with the idea, its keywords, places and links, and these rules.
- **Photos** are listed by their Commons link and never downloaded into the repo.
- **CI checks every post.** A pull request can't merge until these pass:
  - the word counts
  - six places
  - place notes that never name Google, and no more than two that start with the same word
  - a licensed cover and two body photos with alt text
  - the title and description limits
  - a main keyword listed in `keywords.yaml`, said in the title and the first two sentences
  - front matter that follows the format, with parameter keys from `taxonomy.yaml`
  - photos that load as JPEGs of at most 2 MB (skipped when Wikimedia can't be reached)
  - the required sections
  - the brand wording and the style rules a machine can check (dashes, quotes)
- **Local posts.** A local post's city and town each need a place file, already merged or in the same pull request.
- **After anything goes live,** request indexing for the new URL in Search Console.
