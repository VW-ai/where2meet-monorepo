/**
 * Repeated text, measured the way the 2026-10-22 SEO audit measured it
 * (`evidence/content/parse.py` and `content_checks.py`), so CI and the audit report the same numbers.
 */

/** The audit's word pattern. It keeps a trailing period, so "link." and "link" differ. */
const AUDIT_WORD = /[A-Za-z0-9][A-Za-z0-9'.-]*/g;
/**
 * A description echoes its title when this many title words in a row start within its first `ECHO_START`
 * words. A shorter title echoes only when the description starts with all of it.
 */
const ECHO_RUN = 4;
const ECHO_START = 3;
const LINE_BREAK = /\r?\n/;
const SECTION_HEADING = /^## (.*?)\r?$/;
const HOW_TO_HEADING = 'how to do it in where2meet';

function auditWords(text: string): string[] {
  return text.toLowerCase().match(AUDIT_WORD) ?? [];
}

/** The audit's `strip_md`: Markdown as plain words, a link as its text. */
function plainText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^:::places\s*$/gm, ' ')
    .replace(/[#*_>`]/g, ' ');
}

/** The title words a description opens with, as in "where to meet up", or null. */
export function titleEcho(title: string, description: string): string | null {
  const titleWords = auditWords(title);
  const descriptionWords = auditWords(description);
  if (titleWords.length === 0) return null;
  if (titleWords.length < ECHO_RUN) {
    const whole = titleWords.join(' ');
    return descriptionWords.slice(0, titleWords.length).join(' ') === whole ? whole : null;
  }
  const runs = new Set(
    titleWords
      .slice(0, titleWords.length - ECHO_RUN + 1)
      .map((_, at) => titleWords.slice(at, at + ECHO_RUN).join(' '))
  );
  for (let start = 0; start < ECHO_START; start++) {
    const run = descriptionWords.slice(start, start + ECHO_RUN);
    if (run.length === ECHO_RUN && runs.has(run.join(' '))) return run.join(' ');
  }
  return null;
}

/** The words of a post's "How to do it in Where2Meet" section, or none when it has no such section. */
export function howToWords(markdown: string): string[] {
  const lines = markdown.split(LINE_BREAK);
  const heading = lines.findIndex((line) =>
    SECTION_HEADING.exec(line)?.[1].trim().toLowerCase().startsWith(HOW_TO_HEADING)
  );
  if (heading === -1) return [];
  const next = lines.findIndex((line, at) => at > heading && SECTION_HEADING.test(line));
  return auditWords(plainText(lines.slice(heading + 1, next === -1 ? undefined : next).join('\n')));
}

/** Python's `difflib.SequenceMatcher(None, a, b, autojunk=False).ratio()`. */
export function wordSimilarity(a: readonly string[], b: readonly string[]): number {
  if (a.length + b.length === 0) return 1;
  const positions = new Map<string, number[]>();
  b.forEach((word, at) => {
    const list = positions.get(word);
    if (list) list.push(at);
    else positions.set(word, [at]);
  });

  const matched = (aLow: number, aHigh: number, bLow: number, bHigh: number): number => {
    let bestA = aLow;
    let bestB = bLow;
    let bestSize = 0;
    let runs = new Map<number, number>();
    for (let i = aLow; i < aHigh; i++) {
      const next = new Map<number, number>();
      for (const j of positions.get(a[i]) ?? []) {
        if (j < bLow) continue;
        if (j >= bHigh) break;
        const size = (runs.get(j - 1) ?? 0) + 1;
        next.set(j, size);
        if (size > bestSize) {
          bestA = i - size + 1;
          bestB = j - size + 1;
          bestSize = size;
        }
      }
      runs = next;
    }
    if (bestSize === 0) return 0;
    return (
      bestSize +
      matched(aLow, bestA, bLow, bestB) +
      matched(bestA + bestSize, aHigh, bestB + bestSize, bHigh)
    );
  };

  return (2 * matched(0, a.length, 0, b.length)) / (a.length + b.length);
}
