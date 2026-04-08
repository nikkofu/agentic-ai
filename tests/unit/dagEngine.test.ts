import { describe, it, expect } from "vitest";
import { resolveExecutionTiers } from "../../src/core/dagEngine";
import { DagNode, DagWorkflow } from "../../src/types/dag";

describe("DagEngine", () => {
  it("sorts nodes topologically into execution tiers", () => {
    const workflow: DagWorkflow = {
      nodes: [
        { id: "A", role: "system", input: {}, depends_on: [] },
        { id: "B", role: "system", input: {}, depends_on: ["A"] },
        { id: "C", role: "system", input: {}, depends_on: ["A"] },
        { id: "D", role: "system", input: {}, depends_on: ["B", "C"] },
      ]
    };

    const tiers = resolveExecutionTiers(workflow);
    
    expect(tiers.length).toBe(3);
    expect(tiers[0].map(n => n.id)).toEqual(["A"]);
    expect(tiers[1].map(n => n.id).sort()).toEqual(["B", "C"]);
    expect(tiers[2].map(n => n.id)).toEqual(["D"]);
  });

  it("throws an error on circular dependencies", () => {
    const workflow: DagWorkflow = {
      nodes: [
        { id: "A", role: "system", input: {}, depends_on: ["B"] },
        { id: "B", role: "system", input: {}, depends_on: ["A"] },
      ]
    };

    expect(() => resolveExecutionTiers(workflow)).toThrow(/circular/i);
  });
});
