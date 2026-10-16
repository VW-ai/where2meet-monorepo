import { vi } from "vitest";
import { randomInt } from "crypto";

export function drawWith(pick: (max: number) => number): void {
  vi.mocked(randomInt).mockImplementation(pick as unknown as typeof randomInt);
}
