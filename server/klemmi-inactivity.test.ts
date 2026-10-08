import { describe, expect, it } from "vitest";
import {
  IDLE_HINT_DELAYS_MS,
  idleHintDelayMs,
  MAX_IDLE_HINTS_PER_SESSION,
} from "../client/src/lib/klemmi-inactivity";

describe("Klemmi-Inaktivität", () => {
  it("plant höchstens zwei Hinweise nach fünf und zehn Minuten", () => {
    expect(IDLE_HINT_DELAYS_MS).toEqual([5 * 60_000, 10 * 60_000]);
    expect(MAX_IDLE_HINTS_PER_SESSION).toBe(2);
    expect(idleHintDelayMs(0, 0)).toBe(5 * 60_000);
    expect(idleHintDelayMs(0, 5 * 60_000)).toBe(0);
    expect(idleHintDelayMs(1, 5 * 60_000)).toBe(5 * 60_000);
    expect(idleHintDelayMs(1, 10 * 60_000)).toBe(0);
    expect(idleHintDelayMs(2, 60 * 60_000)).toBeNull();
  });
});
