import type { MemoryHistoryEvent } from "./memoryHistory";

export function summarizeMemoryTimeline(events: MemoryHistoryEvent[]) {
  return events
    .slice(-5)
    .map((event) => {
      switch (event.kind) {
        case "promote":
          return `promote: ${event.entryId} -> ${event.toState}`;
        case "compress":
          return `compress: ${event.entryId} <- ${event.sourceIds.join(", ")}`;
        case "demote":
          return `demote: ${event.entryId} -> ${event.toState}`;
        case "mark_stale":
          return `stale: ${event.entryId}`;
        case "mark_superseded":
          return `supersede: ${event.entryId} -> ${event.supersededBy}`;
        case "archive":
          return `archive: ${event.entryId}`;
        case "forget":
          return `forget: ${event.entryId}`;
        case "restore":
          return `restore: ${event.entryId}`;
      }
    });
}
