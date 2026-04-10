import type { MemoryConfidence, MemoryEntryStatus } from "./memoryContracts";

type MemoryTrustInput = {
  verifierSupported?: boolean;
  sourceRefs?: string[];
  reuseCount?: number;
  status: MemoryEntryStatus;
};

type MemoryGateInput = {
  confidence: MemoryConfidence;
  status: MemoryEntryStatus;
};

export function scoreMemoryTrust(input: MemoryTrustInput): MemoryConfidence {
  if (input.status !== "active") {
    return "low";
  }

  const sourceCount = (input.sourceRefs ?? []).filter((entry) => entry.trim().length > 0).length;
  const reuseCount = input.reuseCount ?? 0;

  if (input.verifierSupported && sourceCount >= 2) {
    return "high";
  }

  if (sourceCount >= 1 || reuseCount >= 1) {
    return "medium";
  }

  return "low";
}

export function shouldPromoteEntry(input: MemoryGateInput): boolean {
  return input.status === "active" && input.confidence !== "low";
}

export function shouldInjectEntry(input: MemoryGateInput): boolean {
  return input.status === "active" && input.confidence !== "low";
}

export function shouldMarkStale(input: {
  updatedAt: string;
  staleAfterDays: number;
  now?: number;
}): boolean {
  const updatedAt = Date.parse(input.updatedAt);
  if (Number.isNaN(updatedAt)) {
    return false;
  }

  const now = input.now ?? Date.now();
  const staleAfterMs = input.staleAfterDays * 24 * 60 * 60 * 1000;
  return now - updatedAt > staleAfterMs;
}
