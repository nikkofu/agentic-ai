import fs from "node:fs/promises";
import path from "node:path";

import { resolveMemoryRoot } from "./memoryPaths";

type MemoryEntryLike = {
  id: string;
  body: string;
};

type InspectableMemoryStore = {
  retrieve?: (query: {
    layer: "personal" | "project" | "task";
    state?: "raw" | "curated" | "compressed";
    taskId?: string;
  }) => Promise<Array<{
    id: string;
    body: string;
  }>>;
  getTaskEntries?: (taskId: string) => Promise<Array<{
    sourceId: string;
    content: string;
  }>>;
};

export function createMemoryInspector(args: {
  memoryStore: InspectableMemoryStore;
}) {
  return {
    async inspect(taskId: string) {
      const personal = await loadLayerEntries(args.memoryStore, "personal");
      const project = await loadLayerEntries(args.memoryStore, "project");
      const task = await loadLayerEntries(args.memoryStore, "task", taskId);

      return {
        personal: summarizeEntries(personal),
        project: summarizeEntries(project),
        task: summarizeEntries(task)
      };
    }
  };
}

export function createDreamInspector(args: {
  repoRoot: string;
  userHome: string;
}) {
  const roots = resolveMemoryRoot(args.repoRoot, args.userHome);

  return {
    async inspect(_taskId: string) {
      const reflections = await readDreamFolder(path.join(roots.dreamRoot, "reflections"));
      const recommendations = await readDreamFolder(path.join(roots.dreamRoot, "recommendations"));

      return {
        reflectionsCount: reflections.length,
        latestReflections: reflections.slice(0, 3),
        recommendationsCount: recommendations.length,
        latestRecommendations: recommendations.slice(0, 3)
      };
    }
  };
}

async function loadLayerEntries(
  memoryStore: InspectableMemoryStore,
  layer: "personal" | "project" | "task",
  taskId?: string
): Promise<MemoryEntryLike[]> {
  if (memoryStore.retrieve) {
    const state = layer === "task" ? "raw" : undefined;
    return await memoryStore.retrieve({ layer, state, taskId });
  }

  if (layer === "task" && memoryStore.getTaskEntries) {
    const entries = await memoryStore.getTaskEntries(taskId ?? "");
    return entries.map((entry) => ({
      id: entry.sourceId,
      body: entry.content
    }));
  }

  return [];
}

function summarizeEntries(entries: MemoryEntryLike[]) {
  return {
    count: entries.length,
    latest: entries.slice(-3).reverse().map((entry) => entry.body)
  };
}

async function readDreamFolder(dir: string) {
  try {
    const names = (await fs.readdir(dir)).sort().reverse();
    const contents = await Promise.all(
      names.map(async (name) => {
        const text = await fs.readFile(path.join(dir, name), "utf8");
        return text.trim();
      })
    );
    return contents.filter((entry) => entry.length > 0);
  } catch {
    return [] as string[];
  }
}
