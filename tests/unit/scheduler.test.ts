import { describe, expect, it } from "vitest";

import { select } from "../../src/scheduler/scheduler";

describe("select", () => {
  const frontier = ["node-a", "node-b", "node-c"];

  it("selects queue-head for bfs", () => {
    expect(select(frontier, "bfs")).toBe("node-a");
  });

  it("selects stack-top for dfs", () => {
    expect(select(frontier, "dfs")).toBe("node-c");
  });

  it("returns undefined for empty frontier", () => {
    expect(select([], "bfs")).toBeUndefined();
    expect(select([], "dfs")).toBeUndefined();
  });
});
