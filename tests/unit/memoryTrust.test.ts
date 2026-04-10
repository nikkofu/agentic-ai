import { describe, expect, it } from "vitest";

import {
  scoreMemoryTrust,
  shouldInjectEntry,
  shouldMarkStale,
  shouldPromoteEntry
} from "../../src/runtime/memoryTrust";

describe("memory trust", () => {
  it("scores verifier-supported multi-source entries as high trust", () => {
    expect(scoreMemoryTrust({
      verifierSupported: true,
      sourceRefs: ["a", "b"],
      reuseCount: 2,
      status: "active"
    })).toBe("high");
  });

  it("scores reusable active entries as medium trust", () => {
    expect(scoreMemoryTrust({
      verifierSupported: false,
      sourceRefs: ["a"],
      reuseCount: 1,
      status: "active"
    })).toBe("medium");
  });

  it("scores stale unverified entries as low trust", () => {
    expect(scoreMemoryTrust({
      verifierSupported: false,
      sourceRefs: [],
      reuseCount: 0,
      status: "stale"
    })).toBe("low");
  });

  it("promotes only active medium or high trust entries", () => {
    expect(shouldPromoteEntry({
      confidence: "high",
      status: "active"
    })).toBe(true);
    expect(shouldPromoteEntry({
      confidence: "medium",
      status: "active"
    })).toBe(true);
    expect(shouldPromoteEntry({
      confidence: "low",
      status: "active"
    })).toBe(false);
    expect(shouldPromoteEntry({
      confidence: "high",
      status: "superseded"
    })).toBe(false);
  });

  it("injects only active non-low-trust entries", () => {
    expect(shouldInjectEntry({
      confidence: "high",
      status: "active"
    })).toBe(true);
    expect(shouldInjectEntry({
      confidence: "medium",
      status: "active"
    })).toBe(true);
    expect(shouldInjectEntry({
      confidence: "low",
      status: "active"
    })).toBe(false);
    expect(shouldInjectEntry({
      confidence: "high",
      status: "archived"
    })).toBe(false);
  });

  it("marks entries stale once they exceed configured age", () => {
    const now = Date.parse("2026-04-10T12:00:00.000Z");

    expect(shouldMarkStale({
      updatedAt: "2026-03-01T00:00:00.000Z",
      staleAfterDays: 30,
      now
    })).toBe(true);
    expect(shouldMarkStale({
      updatedAt: "2026-04-05T00:00:00.000Z",
      staleAfterDays: 30,
      now
    })).toBe(false);
  });
});
