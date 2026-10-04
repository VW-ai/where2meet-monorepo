/**
 * Each reader action claims an intent and gets back `isCurrent`. Async work checks it
 * after every await, so a slow answer (a location prompt left open) never overwrites
 * what a newer action asked for.
 */
export function createIntents(): () => () => boolean {
  let latest = 0;
  return () => {
    const mine = ++latest;
    return () => mine === latest;
  };
}
