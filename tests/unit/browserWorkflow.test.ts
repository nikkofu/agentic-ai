import { describe, expect, it } from "vitest";

import { buildBrowserRunSummary, summarizeBrowserWorkflow } from "../../src/runtime/browserWorkflow";

describe("browserWorkflow", () => {
  it("summarizes browser workflow steps and validation", () => {
    const summary = summarizeBrowserWorkflow({
      steps: [
        { kind: "open_session", status: "completed", summary: "opened login page" },
        { kind: "execute_step", status: "completed", summary: "submitted form" },
        { kind: "validate_outcome", status: "completed", summary: "confirmation banner visible" }
      ],
      validation: {
        summary: "confirmation banner visible",
        passed: true
      },
      recoveryAttempts: 1
    });

    expect(summary).toEqual({
      stepCount: 3,
      lastSuccessfulStep: "validate_outcome",
      validationSummary: "confirmation banner visible",
      recoveryAttempts: 1
    });
  });

  it("builds a run summary artifact from workflow execution", () => {
    const artifact = buildBrowserRunSummary({
      steps: [
        { kind: "open_session", status: "completed", summary: "opened page" },
        { kind: "execute_step", status: "blocked", summary: "submit button missing" }
      ],
      validation: {
        summary: "submission not reached",
        passed: false
      },
      recoveryAttempts: 2
    });

    expect(artifact).toContain("steps: 2");
    expect(artifact).toContain("last_successful_step: open_session");
    expect(artifact).toContain("validation: submission not reached");
    expect(artifact).toContain("recovery_attempts: 2");
  });
});
