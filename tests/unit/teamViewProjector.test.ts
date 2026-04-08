import { describe, expect, it } from "vitest";

import { projectTeamView } from "../../src/core/teamViewProjector";

describe("teamViewProjector", () => {
  it("aggregates success and failure per actor", () => {
    const result = projectTeamView([
      {
        type: "AgentStarted",
        payload: { task_id: "t1", node_id: "n1", role: "planner", actor: "alice" },
        ts: 1
      },
      {
        type: "NodeCompleted",
        payload: { task_id: "t1", node_id: "n1", actor: "alice" },
        ts: 2
      },
      {
        type: "AgentStarted",
        payload: { task_id: "t2", node_id: "n2", role: "executor", actor: "bob" },
        ts: 3
      },
      {
        type: "NodeFailed",
        payload: { task_id: "t2", node_id: "n2", actor: "bob" },
        ts: 4
      }
    ]);

    expect(result.byActor.alice.total).toBe(1);
    expect(result.byActor.alice.completed).toBe(1);
    expect(result.byActor.bob.total).toBe(1);
    expect(result.byActor.bob.failed).toBe(1);
  });
});
