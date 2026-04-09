import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createRuntimeServices } from "../../src/runtime/runtimeServices";

afterEach(() => {
  fs.rmSync("artifacts/fix-lint-in-runtask-and-attach-test-proof.md", { force: true });
});

describe("phase 13 code edit gold-path inspection", () => {
  it("surfaces artifact truth, verification preview, and explanation for a completed code-edit task", async () => {
    process.env.OPENROUTER_API_KEY = "k-test";

    const generate = vi.fn(async (request: any) => {
      const system = request.input?.[0]?.content ?? "";
      const currentObjective = request.input.at(-1)?.content ?? "";

      if (String(system).includes("intent classifier")) {
        return {
          outputText: JSON.stringify({
            task_kind: "code_execution",
            execution_mode: "tree",
            roles: ["planner", "coder"],
            needs_verification: false,
            reason: "needs staged edit and test execution"
          }),
          raw: { ok: true }
        };
      }

      if (String(system).includes("planning agent for an autonomous runtime")) {
        return {
          outputText: JSON.stringify({
            summary: "planner summary",
            recommended_tools: ["echo"],
            required_capabilities: ["code_edit", "test"],
            verification_policy: "",
            spawn_children: [
              {
                id: "node-code",
                role: "coder",
                input: "Apply the code edit and include test evidence.",
                depends_on: ["node-root"]
              }
            ]
          }),
          raw: { ok: true }
        };
      }

      if (String(currentObjective).includes("planner summary")) {
        return {
          outputText: JSON.stringify({
            final_result: "plan ready",
            verification: ["planner complete"],
            artifacts: [],
            risks: [],
            next_actions: []
          }),
          raw: { ok: true }
        };
      }

      return {
        outputText: JSON.stringify({
          final_result: "Patched runTask lint issue and verified with `npm test -- --run tests/unit/runTask-args.test.ts`.",
          verification: ["npm test -- --run tests/unit/runTask-args.test.ts"],
          artifacts: [],
          risks: [],
          next_actions: []
        }),
        raw: { ok: true }
      };
    });

    const services = await createRuntimeServices({ generate });

    try {
      const result = await services.taskLifecycle.startTask({
        input: "Fix lint in runTask and attach test proof"
      });
      const inspection = await services.taskLifecycle.inspectTask(result.taskId);

      expect(result.finalState).toBe("completed");
      expect(inspection.runtimeInspector?.intent).toEqual({
        taskKind: "code_execution",
        executionMode: "tree",
        needsVerification: false
      });
      expect(inspection.runtimeInspector?.finalDelivery?.artifacts).toEqual([
        {
          path: "artifacts/fix-lint-in-runtask-and-attach-test-proof.md",
          exists: true,
          nonEmpty: true
        }
      ]);
      expect(inspection.runtimeInspector?.finalDelivery?.verificationPreview).toEqual([
        "npm test -- --run tests/unit/runTask-args.test.ts"
      ]);
      expect(inspection.runtimeInspector?.explanation).toBe(
        "Task completed with 1 artifacts and 1 verification items"
      );
      expect(inspection.runtimeInspector?.actionHint).toBe(
        "Review the final artifacts and verification evidence."
      );
    } finally {
      await services.close();
    }
  });
});
