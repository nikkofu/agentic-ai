import { describe, expect, it } from "vitest";

import { createTaskMemoryStore } from "../../src/runtime/memory";
import { createInMemoryRetrievalProvider, createTaskAwareRetrievalProvider } from "../../src/runtime/retrieval";

describe("runtime retrieval", () => {
  it("retrieves the most relevant indexed document snippets for a task and node objective", async () => {
    const provider = createInMemoryRetrievalProvider({
      documents: [
        {
          sourceId: "doc://openclaw-readme",
          content:
            "OpenClaw is an open-source agent runtime focused on orchestration, tool use, and autonomous execution loops."
        },
        {
          sourceId: "doc://gardening-notes",
          content: "Tomatoes grow best with steady sunlight, deep watering, and healthy soil."
        },
        {
          sourceId: "doc://openclaw-architecture",
          content:
            "The architecture includes planner nodes, researcher nodes, writer nodes, and delivery verification stages."
        }
      ]
    });

    const results = await provider.retrieve({
      taskId: "task-rag-1",
      task: "research OpenClaw and write an article about its runtime architecture",
      role: "writer",
      nodeInput: "summarize the OpenClaw runtime architecture and orchestration model"
    });

    expect(results).toHaveLength(2);
    expect(results[0].sourceId).toBe("doc://openclaw-architecture");
    expect(results[1].sourceId).toBe("doc://openclaw-readme");
    expect(results[0].relevance).toBeGreaterThan(results[1].relevance ?? 0);
  });

  it("returns no retrieval results when documents do not overlap the query", async () => {
    const provider = createInMemoryRetrievalProvider({
      documents: [
        {
          sourceId: "doc://cooking",
          content: "Bake bread with flour, water, salt, and yeast until golden."
        }
      ]
    });

    const results = await provider.retrieve({
      taskId: "task-rag-2",
      task: "research OpenClaw",
      role: "researcher",
      nodeInput: "collect runtime architecture facts"
    });

    expect(results).toEqual([]);
  });

  it("retrieves task-written memory entries for later nodes in the same task", async () => {
    const memoryStore = createTaskMemoryStore();
    await memoryStore.appendEntry({
      taskId: "task-rag-3",
      sourceId: "mem://task-rag-3/node-research",
      content: "OpenClaw uses planner, researcher, and writer nodes with verification before delivery.",
      tags: ["research", "architecture"]
    });

    const provider = createTaskAwareRetrievalProvider({
      baseProvider: createInMemoryRetrievalProvider({
        documents: [
          {
            sourceId: "doc://placeholder",
            content: "Unrelated cooking notes about bread and ovens."
          }
        ]
      }),
      memoryStore
    });

    const results = await provider.retrieve({
      taskId: "task-rag-3",
      task: "write about OpenClaw architecture",
      role: "writer",
      nodeInput: "summarize planner and writer architecture"
    });

    expect(results[0].sourceId).toBe("mem://task-rag-3/node-research");
    expect(results[0].content).toContain("planner, researcher, and writer nodes");
  });
});
