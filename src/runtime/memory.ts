import type { ExecutionContext, RetrievalSnippet } from "./contracts";

export type RetrievalProvider = {
  retrieve: (input: {
    taskId: string;
    task: string;
    role: string;
    nodeInput: string;
  }) => Promise<RetrievalSnippet[]>;
};

export type MemoryStore = {
  loadWorkingMemory: (input: {
    taskId: string;
    task: string;
    role: string;
    nodeInput: string;
  }) => Promise<string[]>;
  loadMemoryRefs: (input: {
    taskId: string;
    task: string;
    role: string;
    nodeInput: string;
  }) => Promise<string[]>;
  appendEntry?: (entry: {
    taskId: string;
    sourceId: string;
    content: string;
    tags?: string[];
  }) => Promise<void>;
  getTaskEntries?: (taskId: string) => Promise<Array<{
    taskId: string;
    sourceId: string;
    content: string;
    tags: string[];
  }>>;
  recordEntry?: (entry: {
    layer: "personal" | "project" | "task";
    state: "raw" | "curated" | "compressed";
    kind: string;
    body: string;
    taskId?: string;
    tags?: string[];
    sourceRefs?: string[];
    confidence?: string;
  }) => Promise<unknown>;
  curate?: (input: {
    layer: "personal" | "project" | "task";
    taskId?: string;
  }) => Promise<Array<{
    id: string;
    body: string;
    state: "raw" | "curated" | "compressed";
  }>>;
  compress?: (input: {
    layer: "personal" | "project" | "task";
    taskId?: string;
  }) => Promise<{
    id: string;
    body: string;
    state: "raw" | "curated" | "compressed";
  } | null>;
};

type RuntimeEventLike = {
  type: string;
  payload: Record<string, unknown>;
};

export async function enrichExecutionContext(args: {
  taskId: string;
  context: ExecutionContext;
  retrievalProvider?: RetrievalProvider;
  memoryStore?: MemoryStore;
}): Promise<ExecutionContext> {
  const { taskId, context, retrievalProvider, memoryStore } = args;
  const request = {
    taskId,
    task: context.task,
    role: context.node.role,
    nodeInput: context.node.input
  };

  const [retrievalContext, workingMemory, memoryRefs] = await Promise.all([
    retrievalProvider?.retrieve(request) ?? Promise.resolve([]),
    memoryStore?.loadWorkingMemory(request) ?? Promise.resolve([]),
    memoryStore?.loadMemoryRefs(request) ?? Promise.resolve([])
  ]);

  return {
    ...context,
    retrievalContext: [...context.retrievalContext, ...retrievalContext],
    workingMemory: [...context.workingMemory, ...workingMemory],
    memoryRefs: [...context.memoryRefs, ...memoryRefs]
  };
}

export function createTaskMemoryStore(): MemoryStore & {
  appendEntry: (entry: {
    taskId: string;
    sourceId: string;
    content: string;
    tags?: string[];
  }) => Promise<void>;
  getTaskEntries: (taskId: string) => Promise<Array<{
    taskId: string;
    sourceId: string;
    content: string;
    tags: string[];
  }>>;
} {
  const entries = new Map<string, Array<{ taskId: string; sourceId: string; content: string; tags: string[] }>>();

  return {
    async loadWorkingMemory({ taskId }) {
      return (entries.get(taskId) ?? []).map((entry) => entry.content);
    },
    async loadMemoryRefs({ taskId }) {
      return (entries.get(taskId) ?? []).map((entry) => entry.sourceId);
    },
    async appendEntry(entry) {
      const list = entries.get(entry.taskId) ?? [];
      list.push({
        taskId: entry.taskId,
        sourceId: entry.sourceId,
        content: entry.content,
        tags: entry.tags ?? []
      });
      entries.set(entry.taskId, list);
    },
    async getTaskEntries(taskId) {
      return [...(entries.get(taskId) ?? [])];
    }
  };
}

export async function replayTaskMemoryFromEvents(args: {
  taskId: string;
  events: RuntimeEventLike[];
  memoryStore?: MemoryStore;
}) {
  if (!args.memoryStore?.appendEntry) {
    return;
  }

  const seen = new Set<string>();
  for (const event of args.events) {
    if (event.type !== "TaskMemoryStored") {
      continue;
    }
    if (event.payload.task_id !== args.taskId) {
      continue;
    }
    const sourceId = typeof event.payload.source_id === "string" ? event.payload.source_id : "";
    const content = typeof event.payload.content === "string" ? event.payload.content : "";
    if (!sourceId || !content) {
      continue;
    }
    const key = `${sourceId}\u0000${content}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    await args.memoryStore.appendEntry({
      taskId: args.taskId,
      sourceId,
      content,
      tags: Array.isArray(event.payload.tags) ? event.payload.tags.filter((tag): tag is string => typeof tag === "string") : []
    });
  }
}
