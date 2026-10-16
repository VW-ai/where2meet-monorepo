/**
 * Stubs the draws behind approximate areas.
 *
 * Call `vi.mock("crypto", ...)` with a `randomInt: vi.fn()` override in the test
 * file first; `vi.mock` only applies to the file that calls it.
 */

import { vi } from "vitest";
import { randomInt } from "crypto";

/**
 * Makes every `randomInt(max)` call return `pick(max)`.
 * 0 puts an area 800 m north, max / 2 puts it 1,265 m south, and max / 4 puts it 1,058 m east.
 */
export function drawWith(pick: (max: number) => number): void {
  vi.mocked(randomInt).mockImplementation(pick as unknown as typeof randomInt);
}
