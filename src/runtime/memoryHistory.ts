import fs from "node:fs/promises";
import path from "node:path";

import { resolveMemoryRoot } from "./memoryPaths";

export type MemoryHistoryEvent =
  | { kind: "promote"; entryId: string; toLayer: string; toState: string; ts?: string }
  | { kind: "compress"; entryId: string; sourceIds: string[]; ts?: string }
  | { kind: "demote"; entryId: string; toState: string; ts?: string }
  | { kind: "mark_stale"; entryId: string; reason: string; ts?: string }
  | { kind: "mark_superseded"; entryId: string; supersededBy: string; ts?: string }
  | { kind: "archive"; entryId: string; reason: string; ts?: string }
  | { kind: "forget"; entryId: string; ts?: string }
  | { kind: "restore"; entryId: string; ts?: string };

type HistoryState = {
  events: MemoryHistoryEvent[];
};

export function createMemoryHistory(args: {
  repoRoot: string;
}) {
  const roots = resolveMemoryRoot(args.repoRoot, process.env.HOME ?? "");
  const filePath = path.join(roots.indexRoot, "memory-history.json");

  const readState = async (): Promise<HistoryState> => {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as HistoryState;
      return {
        events: Array.isArray(parsed.events) ? parsed.events : []
      };
    } catch {
      return { events: [] };
    }
  };

  const writeState = async (state: HistoryState) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(state, null, 2), "utf8");
  };

  return {
    async append(event: MemoryHistoryEvent) {
      const state = await readState();
      state.events.push({
        ...event,
        ts: event.ts ?? new Date().toISOString()
      } as MemoryHistoryEvent);
      await writeState(state);
    },

    async list(query?: { entryId?: string }) {
      const state = await readState();
      return state.events.filter((event) => !query?.entryId || event.entryId === query.entryId);
    }
  };
}
