import type { MemoryStore } from "./memory";

export async function promoteExecutionSummaryToProjectMemory(args: {
  memoryStore?: Pick<MemoryStore, "recordEntry" | "curate" | "compress">;
  taskId: string;
  family: string;
  taskInput: string;
  finalResult: string;
}) {
  if (!args.finalResult.trim()) {
    return;
  }

  const body = `${args.taskInput}\n\n${args.finalResult}`.trim();
  if (!body || !args.memoryStore?.recordEntry) {
    return;
  }

  await args.memoryStore.recordEntry({
    layer: "project",
    state: "raw",
    kind: "task_summary",
    body,
    taskId: args.taskId,
    tags: [args.family || "general", "execution-summary"],
    confidence: "medium"
  });

  const curated = await args.memoryStore.curate?.({
    layer: "project"
  });

  if (curated && curated.length > 1) {
    await args.memoryStore.compress?.({
      layer: "project"
    });
  }
}
