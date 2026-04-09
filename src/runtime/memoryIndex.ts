import type { MemoryLayer, MemoryState } from "./memoryContracts";

type MemoryIndexEntry = {
  id: string;
  layer: MemoryLayer;
  state: MemoryState;
  path: string;
};

export function createMemoryIndex(initialEntries: MemoryIndexEntry[] = []) {
  const entries = new Map(initialEntries.map((entry) => [entry.id, entry] as const));

  return {
    upsert(entry: MemoryIndexEntry) {
      entries.set(entry.id, entry);
      return entry;
    },
    get(id: string) {
      return entries.get(id);
    },
    list(layer?: MemoryLayer, state?: MemoryState) {
      return [...entries.values()].filter((entry) => {
        if (layer && entry.layer !== layer) {
          return false;
        }
        if (state && entry.state !== state) {
          return false;
        }
        return true;
      });
    },
    remove(id: string) {
      entries.delete(id);
    }
  };
}

export type { MemoryIndexEntry };
