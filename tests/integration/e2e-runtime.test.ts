import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";

import { runTask } from "../../src/cli/runTask";

afterEach(() => {
  fs.rmSync("artifacts/build-a-plan.md", { force: true });
  fs.rmSync("logs/runs", { recursive: true, force: true });
  fs.rmSync("audit_trail.jsonl", { force: true });
});

describe("runtime e2e", () => {
  it("runs full loop and returns execution summary", async () => {
    process.env.OPENROUTER_API_KEY = "k-test";

    const generate = vi.fn(async (request: any) => {
      const system = request.input?.[0]?.content ?? "";
      if (String(system).includes("intent classifier")) {
        return {
          outputText: JSON.stringify({
            task_kind: "general",
            execution_mode: "single_node",
            roles: ["planner"],
            needs_verification: false,
            reason: "single step"
          }),
          raw: { ok: true }
        };
      }

      return {
        outputText: JSON.stringify({
          status: "completed",
          output_text: "ok",
          final_result: "ok",
          verification: ["mocked generation"],
          risks: [],
          next_actions: []
        }),
        raw: { ok: true }
      };
    });
    const result = await runTask({ input: "build a plan", generate });

    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.taskId).toBeTruthy();
    expect(result.finalState).toBe("completed");
    expect(result.outputText).toBe("ok");
    expect(result.delivery.status).toBe("completed");
    expect(result.delivery.final_result).toBe("ok");
    expect(result.delivery.verification).toEqual(["mocked generation"]);
    expect(result.delivery.blocking_reason).toBeUndefined();
    expect(result.delivery.artifacts.length).toBeGreaterThan(0);
    const artifactPath = result.delivery.artifacts[0];
    expect(artifactPath).toBe("artifacts/build-a-plan.md");
    expect(fs.existsSync(artifactPath)).toBe(true);
    expect(fs.readFileSync(artifactPath, "utf8").trim()).toContain("ok");

    expect(result.summary.nodeCount).toBeGreaterThanOrEqual(1);
    expect(result.summary.childSpawns).toBe(0);
    expect(result.summary.toolCalls.localSuccess).toBe(0);
    expect(result.summary.toolCalls.mcpSuccess).toBe(0);
    expect(result.summary.evaluatorDecisions.length).toBeGreaterThanOrEqual(1);
    expect(result.summary.path.length).toBeGreaterThanOrEqual(1);
  });

  it("reports real summary counts instead of placeholder values", async () => {
    process.env.OPENROUTER_API_KEY = "k-test";

    const generate = vi.fn(async (request: any) => {
      const system = request.input?.[0]?.content ?? "";
      if (String(system).includes("intent classifier")) {
        return {
          outputText: JSON.stringify({
            task_kind: "general",
            execution_mode: "single_node",
            roles: ["planner"],
            needs_verification: false,
            reason: "single step"
          }),
          raw: { ok: true }
        };
      }

      return {
        outputText: JSON.stringify({
          status: "completed",
          output_text: "ok",
          final_result: "ok",
          verification: ["mocked generation"],
          risks: [],
          next_actions: []
        }),
        raw: { ok: true }
      };
    });

    const result = await runTask({ input: "summary count test", generate });

    expect(result.finalState).toBe("completed");
    expect(result.summary.childSpawns).toBe(0);
    expect(result.summary.toolCalls.localSuccess).toBe(0);
    expect(result.summary.toolCalls.mcpSuccess).toBe(0);
  });

  it("treats empty delivery as incomplete instead of completed", async () => {
    process.env.OPENROUTER_API_KEY = "k-test";

    const generate = vi.fn(async (request: any) => {
      const system = request.input?.[0]?.content ?? "";
      if (String(system).includes("intent classifier")) {
        return {
          outputText: JSON.stringify({
            task_kind: "general",
            execution_mode: "single_node",
            roles: ["planner"],
            needs_verification: false,
            reason: "single step"
          }),
          raw: { ok: true }
        };
      }

      return {
        outputText: JSON.stringify({
          status: "completed",
          output_text: "",
          final_result: "",
          verification: [],
          risks: [],
          next_actions: []
        }),
        raw: { ok: true }
      };
    });

    const result = await runTask({ input: "empty delivery test", generate });

    expect(result.finalState).toBe("aborted");
    expect(result.delivery.status).toBe("blocked");
    expect(result.delivery.blocking_reason).toBe("empty_delivery");
    expect(result.delivery.artifacts).toEqual([]);
  });

  it("blocks research delivery when verification evidence is missing", async () => {
    process.env.OPENROUTER_API_KEY = "k-test";

    const generate = vi.fn(async (request: any) => {
      const system = request.input?.[0]?.content ?? "";
      if (String(system).includes("intent classifier")) {
        return {
          outputText: JSON.stringify({
            task_kind: "research_writing",
            execution_mode: "tree",
            roles: ["planner", "researcher", "writer"],
            needs_verification: true,
            reason: "needs evidence and final article"
          }),
          raw: { ok: true }
        };
      }

      return {
        outputText: JSON.stringify({
          status: "completed",
          output_text: "OpenClaw article draft",
          final_result: "OpenClaw article draft",
          verification: [],
          risks: [],
          next_actions: []
        }),
        raw: { ok: true }
      };
    });

    const result = await runTask({
      input: "调研 openclaw 并写文章",
      generate
    });

    expect(result.finalState).toBe("aborted");
    expect(result.delivery.status).toBe("blocked");
    expect(result.delivery.blocking_reason).toBe("verification_missing");
    expect(result.delivery.artifacts).toEqual([]);
  });

  it("writes the final blocked task state to audit trail after delivery gate rejection", async () => {
    process.env.OPENROUTER_API_KEY = "k-test";

    const generate = vi.fn(async (request: any) => {
      const system = request.input?.[0]?.content ?? "";
      if (String(system).includes("intent classifier")) {
        return {
          outputText: JSON.stringify({
            task_kind: "research_writing",
            execution_mode: "tree",
            roles: ["planner", "researcher", "writer"],
            needs_verification: true,
            reason: "needs evidence and final article"
          }),
          raw: { ok: true }
        };
      }

      return {
        outputText: JSON.stringify({
          status: "completed",
          output_text: "OpenClaw article draft",
          final_result: "OpenClaw article draft",
          verification: [],
          risks: [],
          next_actions: []
        }),
        raw: { ok: true }
      };
    });

    const result = await runTask({
      input: "调研 openclaw 并写文章",
      generate
    });

    const auditLines = fs
      .readFileSync("audit_trail.jsonl", "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const taskClosedEvents = auditLines.filter(
      (record) => record.taskId === result.taskId && record.type === "TaskClosed"
    );

    expect(result.finalState).toBe("aborted");
    expect(taskClosedEvents.at(-1)?.payload?.state).toBe("aborted");
    expect(taskClosedEvents.at(-1)?.payload?.delivery?.blocking_reason).toBe("verification_missing");
    expect(taskClosedEvents.at(-1)?.payload?.final_result).toBe("OpenClaw article draft");
  });

  it("auto-expands research writing tasks into a multi-node workflow", async () => {
    process.env.OPENROUTER_API_KEY = "k-test";

    const generate = vi.fn(async (request: any) => {
      const system = request.input?.[0]?.content ?? "";
      const currentObjective = request.input.at(-1)?.content ?? "";

      if (String(system).includes("intent classifier")) {
        return {
          outputText: JSON.stringify({
            task_kind: "research_writing",
            execution_mode: "tree",
            roles: ["planner", "researcher", "writer"],
            needs_verification: true,
            reason: "needs staged research and writing"
          }),
          raw: { ok: true }
        };
      }

      if (String(system).includes("planning agent for an autonomous runtime")) {
        return {
          outputText: JSON.stringify({
            summary: "planner summary",
            recommended_tools: ["web_search", "verify_sources"],
            required_capabilities: ["research", "verification", "writing"],
            verification_policy: "cite source urls in final delivery",
            spawn_children: [
              {
                id: "node-research",
                role: "researcher",
                input: "Research the topic with tools first.",
                depends_on: ["node-root"]
              },
              {
                id: "node-verify",
                role: "researcher",
                input: "Verify the key claims from the research step.",
                depends_on: ["node-research"]
              },
              {
                id: "node-write",
                role: "writer",
                input: "Write the final article using verified material.",
                depends_on: ["node-research", "node-verify"]
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
            verification: ["planning complete"],
            artifacts: [],
            risks: [],
            next_actions: []
          }),
          raw: { ok: true }
        };
      }

      if (String(currentObjective).includes("Research the topic")) {
        return {
          outputText: JSON.stringify({
            final_result: "research notes",
            verification: ["https://example.com/research"],
            artifacts: [],
            risks: [],
            next_actions: []
          }),
          raw: { ok: true }
        };
      }

      if (String(currentObjective).includes("Verify the key claims")) {
        return {
          outputText: JSON.stringify({
            final_result: "verified claims",
            verification: ["https://example.com/verify"],
            artifacts: [],
            risks: [],
            next_actions: []
          }),
          raw: { ok: true }
        };
      }

      return {
        outputText: JSON.stringify({
          final_result: "知乎文章终稿",
          verification: ["https://example.com/research", "https://example.com/verify"],
          artifacts: [],
          risks: [],
          next_actions: []
        }),
        raw: { ok: true }
      };
    });

    const result = await runTask({
      input: "调研 openclaw 开源项目并写一篇适合知乎发布的文章",
      generate
    });

    const auditLines = fs
      .readFileSync("audit_trail.jsonl", "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const taskEvents = auditLines.filter((record) => record.taskId === result.taskId);
    const scheduledNodeIds = taskEvents
      .filter((record) => record.type === "NodeScheduled")
      .map((record) => record.nodeId);
    const plannerExpanded = taskEvents.find((record) => record.type === "PlannerExpanded");

    expect(result.finalState).toBe("completed");
    expect(result.delivery.final_result).toBe("知乎文章终稿");
    expect(result.summary.nodeCount).toBe(4);
    expect(result.summary.childSpawns).toBe(3);
    expect(scheduledNodeIds).toEqual(["node-root", "node-research", "node-verify", "node-write"]);
    expect(taskEvents.some((record) => record.type === "IntentClassified")).toBe(true);
    expect(taskEvents.some((record) => record.type === "PlannerExpanded")).toBe(true);
    expect(plannerExpanded?.payload?.recommended_tools).toEqual(["web_search", "verify_sources"]);
    expect(plannerExpanded?.payload?.required_capabilities).toEqual(["research", "verification", "writing"]);
    expect(plannerExpanded?.payload?.verification_policy).toBe("cite source urls in final delivery");
  });
});
