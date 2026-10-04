import { describe, expect, it } from 'vitest';
import { createIntents } from '../latest-intent';

describe('createIntents', () => {
  it('keeps only the newest intent current', () => {
    const claim = createIntents();
    const location = claim();
    expect(location()).toBe(true);

    const city = claim();
    expect([location(), city()]).toEqual([false, true]);
  });

  it('drops a location answer that arrives after a newer city search', async () => {
    const claim = createIntents();
    const shown: string[] = [];
    const showWhenCurrent = async (isCurrent: () => boolean, answer: Promise<string>) => {
      const result = await answer;
      if (isCurrent()) shown.push(result);
    };

    let answerLocation = (_: string) => {};
    const location = showWhenCurrent(claim(), new Promise((resolve) => (answerLocation = resolve)));
    await showWhenCurrent(claim(), Promise.resolve('Chicago'));
    answerLocation('near you');
    await location;

    expect(shown).toEqual(['Chicago']);
  });
});
