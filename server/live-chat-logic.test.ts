import { describe, expect, it } from "vitest";
import {
  shouldRenewTypingStatus,
  TYPING_RENEWAL_MS,
} from "../client/src/components/live-chat-logic";

describe("Live-Chat Typing-Erneuerung", () => {
  it("erneuert einen fortlaufenden Tippstatus vor Ablauf der serverseitigen 8-Sekunden-TTL, aber nicht bei jedem Tastendruck", () => {
    const firstReportedAt = 10_000;

    expect(shouldRenewTypingStatus(0, firstReportedAt)).toBe(true);
    expect(
      shouldRenewTypingStatus(firstReportedAt, firstReportedAt + TYPING_RENEWAL_MS - 1)
    ).toBe(false);
    expect(
      shouldRenewTypingStatus(firstReportedAt, firstReportedAt + TYPING_RENEWAL_MS)
    ).toBe(true);
  });
});
