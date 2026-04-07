import { describe, expect, it } from "vitest";

import { composePromptPayload } from "../../src/prompt/promptComposer";

describe("composePromptPayload", () => {
  it("builds structured payload with required sections", () => {
    const payload = composePromptPayload({
      system: "system-rules",
      role: "planner",
      task: "plan a feature",
      context: ["ctx-a"],
      tools: ["tool-a"],
      memory: ["mem-a"],
      constraints: ["no-mock"],
      outputSchema: { type: "json", shape: { ok: "boolean" } }
    });

    expect(payload.system).toBe("system-rules");
    expect(payload.role).toBe("planner");
    expect(payload.task).toBe("plan a feature");
    expect(payload.context).toEqual(["ctx-a"]);
    expect(payload.tools).toEqual(["tool-a"]);
    expect(payload.memory).toEqual(["mem-a"]);
    expect(payload.constraints).toEqual(["no-mock"]);
    expect(payload.output_schema).toEqual({ type: "json", shape: { ok: "boolean" } });
  });
});
