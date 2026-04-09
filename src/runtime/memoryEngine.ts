import fs from "node:fs/promises";
import path from "node:path";

import type { MemoryStore } from "./memory";
import { createMemoryIndex, type MemoryIndexEntry } from "./memoryIndex";
import { serializeMemoryMarkdown, parseMemoryMarkdown } from "./memoryMarkdown";
import type { MemoryLayer, MemoryState } from "./memoryContracts";
import { resolveMemoryRoot } from "./memoryPaths";

export type MemoryEngineEntry = {
  id: string;
  layer: MemoryLayer;
  state: MemoryState;
  kind: string;
  body: string;
  path: string;
  taskId?: string;
  tags: string[];
  confidence: string;
  sourceRefs: string[];
};

export function createMemoryEngine(args: {
  repoRoot: string;
  userHome: string;
}): MemoryStore & {
  record: (input: {
    layer: MemoryLayer;
    state: MemoryState;
    kind: string;
    body: string;
    taskId?: string;
    tags?: string[];
    confidence?: string;
    sourceRefs?: string[];
  }) => Promise<MemoryEngineEntry>;
  retrieve: (query: {
    layer: MemoryLayer;
    state?: MemoryState;
    taskId?: string;
  }) => Promise<MemoryEngineEntry[]>;
  promote: (input: {
    id: string;
    toState: Exclude<MemoryState, "raw">;
  }) => Promise<MemoryEngineEntry>;
  curate: (input: {
    layer: MemoryLayer;
    taskId?: string;
  }) => Promise<MemoryEngineEntry[]>;
  compress: (input: {
    layer: MemoryLayer;
    taskId?: string;
  }) => Promise<MemoryEngineEntry | null>;
} {
  const roots = resolveMemoryRoot(args.repoRoot, args.userHome);
  const index = createMemoryIndex();
  let idCounter = 0;

  const resolveLayerDir = (layer: MemoryLayer, state: MemoryState, taskId?: string) => {
    switch (layer) {
      case "personal":
        return path.join(roots.personalRoot, state);
      case "project":
        return path.join(roots.projectRoot, state);
      case "task":
        return path.join(roots.taskRoot, taskId ?? "global", state);
    }
  };

  const ensureDir = async (dir: string) => {
    await fs.mkdir(dir, { recursive: true });
  };

  const readEntry = async (filePath: string): Promise<MemoryEngineEntry> => {
    const parsed = parseMemoryMarkdown(await fs.readFile(filePath, "utf8"));
    const frontmatter = parsed.frontmatter as any;
    return {
      id: String(frontmatter.id),
      layer: frontmatter.layer,
      state: frontmatter.state,
      kind: String(frontmatter.kind ?? ""),
      body: parsed.body,
      path: filePath,
      taskId: typeof frontmatter.taskId === "string" ? frontmatter.taskId : undefined,
      tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
      confidence: String(frontmatter.confidence ?? "medium"),
      sourceRefs: Array.isArray(frontmatter.source_refs) ? frontmatter.source_refs : []
    };
  };

  const writeEntry = async (entry: Omit<MemoryEngineEntry, "path">) => {
    const dir = resolveLayerDir(entry.layer, entry.state, entry.taskId);
    await ensureDir(dir);
    const filePath = path.join(dir, `${entry.id}.md`);
    await fs.writeFile(filePath, serializeMemoryMarkdown({
      frontmatter: {
        id: entry.id,
        layer: entry.layer,
        state: entry.state,
        kind: entry.kind,
        confidence: entry.confidence,
        tags: entry.tags,
        taskId: entry.taskId,
        source_refs: entry.sourceRefs
      } as any,
      body: entry.body
    }), "utf8");

    index.upsert({
      id: entry.id,
      layer: entry.layer,
      state: entry.state,
      path: filePath
    } satisfies MemoryIndexEntry);

    return {
      ...entry,
      path: filePath
    };
  };

  const record = async (input: {
    layer: MemoryLayer;
    state: MemoryState;
    kind: string;
    body: string;
    taskId?: string;
    tags?: string[];
    confidence?: string;
    sourceRefs?: string[];
  }) => {
      const id = `${input.layer}-${Date.now()}-${++idCounter}`;
      return await writeEntry({
        id,
        layer: input.layer,
        state: input.state,
        kind: input.kind,
        body: input.body,
        taskId: input.taskId,
        tags: input.tags ?? [],
        confidence: input.confidence ?? "medium",
        sourceRefs: input.sourceRefs ?? []
      });
    };

  const retrieve = async (query: {
    layer: MemoryLayer;
    state?: MemoryState;
    taskId?: string;
  }) => {
      const matches = index.list(query.layer, query.state);
      const entries = await Promise.all(matches.map((entry) => readEntry(entry.path)));
      return entries.filter((entry) => !query.taskId || entry.taskId === query.taskId);
    };

  const promote = async ({ id, toState }: {
    id: string;
    toState: Exclude<MemoryState, "raw">;
  }) => {
      const existing = index.get(id);
      if (!existing) {
        throw new Error(`Memory entry not found: ${id}`);
      }
      const current = await readEntry(existing.path);
      return await writeEntry({
        ...current,
        state: toState
      });
    };

  const curate = async ({ layer, taskId }: {
    layer: MemoryLayer;
    taskId?: string;
  }) => {
      const rawEntries = await retrieve({ layer, state: "raw", taskId });
      const curatedEntries = await retrieve({ layer, state: "curated", taskId });
      const seenBodies = new Set(curatedEntries.map((entry) => entry.body.trim()));
      const promoted: MemoryEngineEntry[] = [];

      for (const entry of rawEntries) {
        const normalizedBody = entry.body.trim();
        if (!normalizedBody || seenBodies.has(normalizedBody)) {
          continue;
        }
        seenBodies.add(normalizedBody);
        promoted.push(await writeEntry({
          ...entry,
          state: "curated"
        }));
      }

      return [...curatedEntries, ...promoted];
    };

  const compress = async ({ layer, taskId }: {
    layer: MemoryLayer;
    taskId?: string;
  }) => {
      const curatedEntries = await retrieve({ layer, state: "curated", taskId });
      const uniqueBodies = [...new Set(
        curatedEntries
          .map((entry) => entry.body.trim())
          .filter((body) => body.length > 0)
      )];

      if (uniqueBodies.length === 0) {
        return null;
      }

      return await writeEntry({
        id: `${layer}-compressed-${Date.now()}-${++idCounter}`,
        layer,
        state: "compressed",
        kind: `${layer}_compressed_summary`,
        body: uniqueBodies.join("\n\n"),
        taskId,
        tags: ["compressed-summary"],
        confidence: "medium",
        sourceRefs: []
      });
    };

  const loadWorkingMemory = async ({ taskId }: { taskId: string }) => {
      const taskEntries = await retrieve({ layer: "task", state: "raw", taskId });
      return taskEntries.map((entry) => entry.body);
    };

  const loadMemoryRefs = async ({ taskId }: { taskId: string }) => {
      const taskEntries = await retrieve({ layer: "task", state: "raw", taskId });
      return taskEntries.map((entry) => entry.id);
    };

  const appendEntry = async (entry: {
      taskId: string;
      sourceId: string;
      content: string;
      tags?: string[];
    }) => {
      await record({
        layer: "task",
        state: "raw",
        taskId: entry.taskId,
        kind: "task_memory",
        body: entry.content,
        tags: entry.tags,
        sourceRefs: [entry.sourceId]
      });
    };

  const getTaskEntries = async (taskId: string) => {
      const taskEntries = await retrieve({ layer: "task", state: "raw", taskId });
      return taskEntries.map((entry) => ({
        taskId,
        sourceId: entry.sourceRefs[0] ?? entry.id,
        content: entry.body,
        tags: entry.tags
      }));
    };

  const recordEntry = async (entry: {
      layer: "personal" | "project" | "task";
      state: "raw" | "curated" | "compressed";
      kind: string;
      body: string;
      taskId?: string;
      tags?: string[];
      sourceRefs?: string[];
      confidence?: string;
    }) => {
      return await record({
        layer: entry.layer,
        state: entry.state,
        taskId: entry.taskId,
        kind: entry.kind,
        body: entry.body,
        tags: entry.tags,
        sourceRefs: entry.sourceRefs,
        confidence: entry.confidence
      });
    };

  return {
    record,
    retrieve,
    promote,
    curate,
    compress,
    loadWorkingMemory,
    loadMemoryRefs,
    appendEntry,
    getTaskEntries,
    recordEntry
  };
}
