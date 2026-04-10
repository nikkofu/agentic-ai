import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createCompletionHarness } from "../../src/runtime/completionHarness";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("completion harness", () => {
  it("counts accepted deliveries as successful completion evidence", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase19-harness-"));
    tempRoots.push(repoRoot);
    const harness = createCompletionHarness({ repoRoot });

    await harness.appendRecord({
      taskId: "task-1",
      family: "research_writing",
      taskInput: "research topic",
      finalState: "completed",
      deliveryStatus: "completed",
      acceptanceDecision: "accept",
      verifierSummary: "accepted",
      artifactCount: 1,
      verificationCount: 2
    });

    const summary = await harness.summarizeFamilies();

    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({
      family: "research_writing",
      totalRuns: 1,
      successfulRuns: 1,
      acceptedRuns: 1,
      blockedRuns: 0,
      completionRate: 1,
      acceptanceRate: 1
    });
  });

  it("does not count blocked or rejected deliveries as successful completion evidence", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase19-harness-"));
    tempRoots.push(repoRoot);
    const harness = createCompletionHarness({ repoRoot });

    await harness.appendRecord({
      taskId: "task-2",
      family: "browser_workflow",
      taskInput: "submit a form",
      finalState: "aborted",
      deliveryStatus: "blocked",
      acceptanceDecision: "reject",
      verifierSummary: "rejected",
      artifactCount: 0,
      verificationCount: 1
    });

    const summary = await harness.summarizeFamilies();

    expect(summary[0]).toMatchObject({
      family: "browser_workflow",
      totalRuns: 1,
      successfulRuns: 0,
      acceptedRuns: 0,
      blockedRuns: 1,
      completionRate: 0,
      acceptanceRate: 0
    });
  });

  it("fails the release gate when a required family lacks accepted evidence", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase19-harness-"));
    tempRoots.push(repoRoot);
    const harness = createCompletionHarness({
      repoRoot,
      requiredFamilies: ["research_writing", "browser_workflow"]
    });

    await harness.appendRecord({
      taskId: "task-3",
      family: "research_writing",
      taskInput: "research topic",
      finalState: "completed",
      deliveryStatus: "completed",
      acceptanceDecision: "accept",
      verifierSummary: "accepted",
      artifactCount: 1,
      verificationCount: 2
    });

    const gate = await harness.evaluateReleaseGate();

    expect(gate.ready).toBe(false);
    expect(gate.reasons.join(" ")).toContain("browser_workflow");
  });
});
