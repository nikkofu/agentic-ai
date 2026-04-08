import { describe, expect, it } from "vitest";

import { buildAdoptionReport } from "../../src/cli/adoptionReport";

describe("adoptionReport", () => {
  it("computes success rate and recovery metrics from events", () => {
    const report = buildAdoptionReport([
      { type: "TaskSubmitted", payload: { task_id: "t1", actor: "alice" }, ts: 1000 },
      { type: "TaskClosed", payload: { task_id: "t1", state: "completed", actor: "alice" }, ts: 2000 },
      { type: "TaskSubmitted", payload: { task_id: "t2", actor: "bob" }, ts: 3000 },
      { type: "TaskClosed", payload: { task_id: "t2", state: "failed", actor: "bob" }, ts: 4000 },
      { type: "RetryScheduled", payload: { task_id: "t2", delay_ms: 1500 }, ts: 3500 },
      { type: "TemplateApplied", payload: { task_id: "t1", template: "research" }, ts: 1500 }
    ] as any);

    expect(report.summary.totalTasks).toBe(2);
    expect(report.summary.successRate).toBe(0.5);
    expect(report.summary.recoveryEvents).toBe(1);
    expect(report.summary.avgRecoveryMs).toBe(1500);
    expect(report.summary.templateUsage.research).toBe(1);
  });
});
