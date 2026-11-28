/** What a link from elsewhere on the site hands the home page: a draft to start from. */
export interface PlanSeed {
  title?: string;
  placeId?: string;
  src?: string;
  time?: string;
}

const TITLE_MAX = 100;
const PLACE_ID = /^[A-Za-z0-9_-]{20,255}$/;
const SRC = /^[a-z0-9][a-z0-9-]{0,79}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/** The home page link that starts a plan from `seed`, leaving out empty fields. */
export function planHref({ title, placeId, src, time }: PlanSeed): string {
  const params = new URLSearchParams();
  if (title) params.set('title', title);
  if (placeId) params.set('place', placeId);
  if (src) params.set('src', src);
  if (time) params.set('time', time);
  const query = params.toString();
  return query ? `/?${query}` : '/';
}

/**
 * The seed in a home page URL. The title is cut to 100 characters; a place ID, source or
 * time that fails its check is dropped, and so is a time that has already passed.
 */
export function readPlanSeed(params: URLSearchParams, now = new Date()): PlanSeed {
  const seed: PlanSeed = {};
  const title = params.get('title')?.trim().slice(0, TITLE_MAX).trim();
  if (title) seed.title = title;
  const placeId = params.get('place');
  if (placeId && PLACE_ID.test(placeId)) seed.placeId = placeId;
  const src = params.get('src');
  if (src && SRC.test(src)) seed.src = src;
  const time = params.get('time');
  if (time && ISO_DATETIME.test(time)) {
    const date = new Date(time);
    if (date > now) seed.time = date.toISOString();
  }
  return seed;
}
