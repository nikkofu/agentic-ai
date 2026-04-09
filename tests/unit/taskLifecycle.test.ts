import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTaskLifecycle } from "../../src/runtime/taskLifecycle";

afterEach(() => {
  fs.rmSync(path.resolve("artifacts", "phase13-proof.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "phase13-empty.md"), { force: true });
});

describe("task lifecycle", () => {
  it("delegates start and resume to the shared executor", async () => {
    const lifecycle = createTaskLifecycle({
      executor: {
        execute: vi.fn().mockResolvedValue({ taskId: "task-1", finalState: "completed" }),
        resume: vi.fn().mockResolvedValue({ taskId: "task-2", finalState: "completed" })
      } as any,
      taskStore: {
        getGraph: vi.fn(),
        getEvents: vi.fn()
      } as any
    });

    await lifecycle.startTask({ input: "do work" });
    await lifecycle.resumeTask({ taskId: "task-2" });

    expect(lifecycle).toBeDefined();
  });

  it("inspects a task from graph and events", async () => {
    const lifecycle = createTaskLifecycle({
      executor: {
        execute: vi.fn(),
        resume: vi.fn()
      } as any,
      taskStore: {
        getGraph: vi.fn().mockResolvedValue({
          taskId: "task-1",
          status: "completed",
          nodes: {}
        }),
        getEvents: vi.fn().mockResolvedValue([
          { type: "TaskSubmitted", payload: { task_id: "task-1" } },
          { type: "TaskClosed", payload: { task_id: "task-1", state: "completed" } }
        ])
      } as any
    });

    const inspection = await lifecycle.inspectTask("task-1");

    expect(inspection.graph?.status).toBe("completed");
    expect(inspection.latestClose?.type).toBe("TaskClosed");
    expect(inspection.eventCount).toBe(2);
  });

  it("exposes the latest async task event alongside close events", async () => {
    const lifecycle = createTaskLifecycle({
      executor: {
        execute: vi.fn(),
        resume: vi.fn()
      } as any,
      taskStore: {
        getGraph: vi.fn().mockResolvedValue({
          taskId: "task-async",
          status: "running",
          nodes: {}
        }),
        getEvents: vi.fn().mockResolvedValue([
          { type: "TaskSubmitted", payload: { task_id: "task-async" } },
          {
            type: "AsyncTaskSettled",
            payload: {
              task_id: "task-async",
              job_kind: "resume",
              final_state: "completed",
              delivery: {
                status: "completed",
                final_result: "async done"
              }
            }
          }
        ])
      } as any
    });

    const inspection = await lifecycle.inspectTask("task-async");

    expect(inspection.latestAsync?.type).toBe("AsyncTaskSettled");
    expect(inspection.latestAsync?.payload.final_state).toBe("completed");
  });

  it("exposes the latest async node event for distributed inspection", async () => {
    const lifecycle = createTaskLifecycle({
      executor: {
        execute: vi.fn(),
        resume: vi.fn()
      } as any,
      taskStore: {
        getGraph: vi.fn().mockResolvedValue({
          taskId: "task-node-async",
          status: "running",
          nodes: {}
        }),
        getEvents: vi.fn().mockResolvedValue([
          { type: "TaskSubmitted", payload: { task_id: "task-node-async" } },
          {
            type: "AsyncNodeSettled",
            payload: {
              task_id: "task-node-async",
              node_id: "node-research",
              owner_id: "worker-alpha",
              dedupe_key: "task-node-async-node-research",
              final_state: "completed",
              final_result: "research complete"
            }
          }
        ])
      } as any
    });

    const inspection = await lifecycle.inspectTask("task-node-async");

    expect(inspection.latestAsyncNode?.type).toBe("AsyncNodeSettled");
    expect(inspection.latestAsyncNode?.payload.owner_id).toBe("worker-alpha");
    expect(inspection.latestAsyncNode?.payload.dedupe_key).toBe("task-node-async-node-research");
  });

  it("summarizes distributed queue and join readiness from the task graph", async () => {
    const lifecycle = createTaskLifecycle({
      executor: {
        execute: vi.fn(),
        resume: vi.fn()
      } as any,
      taskStore: {
        getGraph: vi.fn().mockResolvedValue({
          taskId: "task-distributed-summary",
          status: "running",
          nodes: {
            "node-root": { state: "completed", role: "planner" },
            "node-a": { state: "pending", role: "researcher" },
            "node-b": { state: "completed", role: "writer" },
            "join-task-distributed-summary": { state: "pending", role: "planner" }
          }
        }),
        getEvents: vi.fn().mockResolvedValue([
          { type: "TaskSubmitted", payload: { task_id: "task-distributed-summary" } }
        ])
      } as any
    });

    const inspection = await lifecycle.inspectTask("task-distributed-summary");

    expect(inspection.distributedSummary).toEqual({
      queuedNodes: 1,
      activeJoinState: "pending",
      settledWorkerNodes: 2
    });
  });

  it("builds a runtime inspector summary from intent, planner, and delivery events", async () => {
    const lifecycle = createTaskLifecycle({
      executor: {
        execute: vi.fn(),
        resume: vi.fn()
      } as any,
      taskStore: {
        getGraph: vi.fn().mockResolvedValue({
          taskId: "task-inspector",
          status: "aborted",
          nodes: {
            "node-root": { state: "aborted", role: "planner" }
          }
        }),
        getEvents: vi.fn().mockResolvedValue([
          {
            type: "IntentClassified",
            payload: {
              task_id: "task-inspector",
              task_kind: "research_writing",
              execution_mode: "tree",
              needs_verification: true
            }
          },
          {
            type: "PlannerExpanded",
            payload: {
              task_id: "task-inspector",
              recommended_tools: ["web_search", "verify_sources"],
              required_capabilities: ["research", "verification"],
              verification_policy: "cite urls"
            }
          },
          {
            type: "TaskClosed",
            payload: {
              task_id: "task-inspector",
              state: "aborted",
              delivery: {
                status: "blocked",
                final_result: "",
                artifacts: [],
                verification: ["https://example.com/source"],
                blocking_reason: "policy_verification_required"
              },
              blocking_reason: "policy_verification_required"
            }
          }
        ])
      } as any
    });

    const inspection = await lifecycle.inspectTask("task-inspector");

    expect(inspection.runtimeInspector).toEqual({
      intent: {
        taskKind: "research_writing",
        executionMode: "tree",
        needsVerification: true
      },
      plannerPolicy: {
        recommendedTools: ["web_search", "verify_sources"],
        requiredCapabilities: ["research", "verification"],
        verificationPolicy: "cite urls"
      },
      finalDelivery: {
        family: "",
        status: "blocked",
        finalResult: "",
        blockingReason: "policy_verification_required",
        verificationCount: 1,
        artifactCount: 0,
        sourceCoverage: 0,
        verifiedClaimCount: 0,
        stepCount: 0,
        lastSuccessfulStep: "",
        validationSummary: "policy_verification_required",
        recoveryAttempts: 0,
        runProofSummary: "",
        acceptanceDecision: "",
        verifierSummary: "",
        findingsCount: 0,
        findingsPreview: [],
        artifacts: [],
        verificationPreview: ["https://example.com/source"],
        referencesPreview: []
      },
      plan: {
        nodeCount: 1,
        latestJoinDecision: "",
        activeNodePath: "node-root"
      },
      explanation: "Task blocked: policy_verification_required",
      actionHint: "Add verification evidence before attempting final delivery again."
    });
  });

  it("includes plan and closure explanation from planner and join events", async () => {
    const lifecycle = createTaskLifecycle({
      executor: {
        execute: vi.fn(),
        resume: vi.fn()
      } as any,
      taskStore: {
        getGraph: vi.fn().mockResolvedValue({
          taskId: "task-plan-inspector",
          status: "completed",
          nodes: {
            "node-root": { state: "completed", role: "planner" },
            "node-research": { state: "completed", role: "researcher" },
            "node-write": { state: "completed", role: "writer" }
          }
        }),
        getEvents: vi.fn().mockResolvedValue([
          {
            type: "NodeScheduled",
            payload: {
              task_id: "task-plan-inspector",
              node_id: "node-root"
            }
          },
          {
            type: "NodeScheduled",
            payload: {
              task_id: "task-plan-inspector",
              node_id: "node-research"
            }
          },
          {
            type: "JoinEvaluated",
            payload: {
              task_id: "task-plan-inspector",
              decision: "deliver"
            }
          },
          {
            type: "TaskClosed",
            payload: {
              task_id: "task-plan-inspector",
              state: "completed",
              delivery: {
                status: "completed",
                final_result: "final article",
                artifacts: ["artifacts/openclaw.md"],
                verification: ["https://example.com/source-a", "https://example.com/source-b"]
              }
            }
          }
        ])
      } as any
    });

    const inspection = await lifecycle.inspectTask("task-plan-inspector");

    expect(inspection.runtimeInspector?.plan).toEqual({
      nodeCount: 3,
      latestJoinDecision: "deliver",
      activeNodePath: "node-research"
    });
    expect(inspection.runtimeInspector?.explanation).toBe("Task completed with 1 artifacts and 2 verification items");
    expect(inspection.runtimeInspector?.actionHint).toBe("Review the final artifacts and verification evidence.");
  });

  it("reports artifact truth and verification previews for final delivery", async () => {
    fs.mkdirSync(path.resolve("artifacts"), { recursive: true });
    fs.writeFileSync(path.resolve("artifacts", "phase13-proof.md"), "hello world", "utf8");
    fs.writeFileSync(path.resolve("artifacts", "phase13-empty.md"), "", "utf8");

    const lifecycle = createTaskLifecycle({
      executor: {
        execute: vi.fn(),
        resume: vi.fn()
      } as any,
      taskStore: {
        getGraph: vi.fn().mockResolvedValue({
          taskId: "task-artifact-proof",
          status: "completed",
          nodes: {
            "node-root": { state: "completed", role: "planner" }
          }
        }),
        getEvents: vi.fn().mockResolvedValue([
          {
            type: "TaskClosed",
            payload: {
              task_id: "task-artifact-proof",
              state: "completed",
              delivery: {
                status: "completed",
                final_result: "final article",
                artifacts: ["artifacts/phase13-proof.md", "artifacts/phase13-empty.md", "artifacts/missing.md"],
                verification: [
                  "https://example.com/source-a",
                  "https://example.com/source-b",
                  "https://example.com/source-c"
                ]
              }
            }
          }
        ])
      } as any
    });

    const inspection = await lifecycle.inspectTask("task-artifact-proof");

    expect(inspection.runtimeInspector?.finalDelivery?.artifacts).toEqual([
      {
        path: "artifacts/phase13-proof.md",
        exists: true,
        nonEmpty: true
      },
      {
        path: "artifacts/phase13-empty.md",
        exists: true,
        nonEmpty: false
      },
      {
        path: "artifacts/missing.md",
        exists: false,
        nonEmpty: false
      }
    ]);
    expect(inspection.runtimeInspector?.finalDelivery?.verificationPreview).toEqual([
      "https://example.com/source-a",
      "https://example.com/source-b",
      "https://example.com/source-c"
    ]);
  });

  it("builds family-aware research delivery summaries", async () => {
    const lifecycle = createTaskLifecycle({
      executor: {
        execute: vi.fn(),
        resume: vi.fn()
      } as any,
      taskStore: {
        getGraph: vi.fn().mockResolvedValue({
          taskId: "task-family-research",
          status: "completed",
          nodes: {
            "node-root": { state: "completed", role: "planner" }
          }
        }),
        getEvents: vi.fn().mockResolvedValue([
          {
            type: "TaskClosed",
            payload: {
              task_id: "task-family-research",
              state: "completed",
              delivery: {
                status: "completed",
                final_result: "final article",
                family: "research_writing",
                artifacts: [],
                verification: [
                  { kind: "source", sourceId: "a", summary: "README", passed: true },
                  { kind: "source", sourceId: "b", summary: "Docs", passed: true }
                ],
                acceptance_proof: {
                  decision: "accept",
                  verifierSummary: "Accepted research delivery with 2 verified sources.",
                  findings: []
                },
                delivery_proof: {
                  family: "research_writing",
                  steps: []
                }
              }
            }
          }
        ])
      } as any
    });

    const inspection = await lifecycle.inspectTask("task-family-research");

    expect(inspection.runtimeInspector?.finalDelivery?.family).toBe("research_writing");
    expect(inspection.runtimeInspector?.finalDelivery?.sourceCoverage).toBe(2);
    expect(inspection.runtimeInspector?.finalDelivery?.verifiedClaimCount).toBe(2);
    expect(inspection.runtimeInspector?.finalDelivery?.runProofSummary).toBe("source_coverage=2; references=2");
    expect(inspection.runtimeInspector?.finalDelivery?.acceptanceDecision).toBe("accept");
    expect(inspection.runtimeInspector?.finalDelivery?.verifierSummary).toBe("Accepted research delivery with 2 verified sources.");
    expect(inspection.runtimeInspector?.explanation).toBe("Research delivery accepted with 2 verified sources and 0 artifacts");
  });

  it("builds family-aware browser workflow summaries", async () => {
    const lifecycle = createTaskLifecycle({
      executor: {
        execute: vi.fn(),
        resume: vi.fn()
      } as any,
      taskStore: {
        getGraph: vi.fn().mockResolvedValue({
          taskId: "task-family-browser",
          status: "aborted",
          nodes: {
            "node-root": { state: "aborted", role: "planner" }
          }
        }),
        getEvents: vi.fn().mockResolvedValue([
          {
            type: "TaskClosed",
            payload: {
              task_id: "task-family-browser",
              state: "aborted",
              delivery: {
                status: "blocked",
                final_result: "",
                family: "browser_workflow",
                artifacts: [],
                verification: [],
                blocking_reason: "browser_outcome_not_reached",
                acceptance_proof: {
                  decision: "revise",
                  verifierSummary: "Browser verifier found 1 issue(s).",
                  findings: [
                    {
                      severity: "major",
                      kind: "browser_outcome_mismatch",
                      summary: "submit button missing"
                    }
                  ]
                },
                delivery_proof: {
                  family: "browser_workflow",
                  steps: [
                    { kind: "open_session", status: "completed", summary: "opened page" },
                    { kind: "execute_step", status: "blocked", summary: "submit button missing" }
                  ],
                  replayHints: ["reload page and retry"]
                }
              }
            }
          }
        ])
      } as any
    });

    const inspection = await lifecycle.inspectTask("task-family-browser");

    expect(inspection.runtimeInspector?.finalDelivery?.family).toBe("browser_workflow");
    expect(inspection.runtimeInspector?.finalDelivery?.stepCount).toBe(2);
    expect(inspection.runtimeInspector?.finalDelivery?.runProofSummary).toBe("steps=2; last_successful=open_session; validation=browser_outcome_not_reached");
    expect(inspection.runtimeInspector?.finalDelivery?.acceptanceDecision).toBe("revise");
    expect(inspection.runtimeInspector?.finalDelivery?.findingsCount).toBe(1);
    expect(inspection.runtimeInspector?.finalDelivery?.findingsPreview).toEqual(["submit button missing"]);
    expect(inspection.runtimeInspector?.explanation).toBe("Browser workflow revise: Browser verifier found 1 issue(s).");
    expect(inspection.runtimeInspector?.actionHint).toBe("Retry the workflow, re-locate the target, or reload the page before resuming.");
  });
});
