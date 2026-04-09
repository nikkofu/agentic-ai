import type { DeliveryProofStep } from "./contracts";

type BrowserValidation = {
  summary: string;
  passed: boolean;
};

export function summarizeBrowserWorkflow(args: {
  steps: DeliveryProofStep[];
  validation: BrowserValidation;
  recoveryAttempts?: number;
}) {
  const lastSuccessfulStep = [...args.steps]
    .reverse()
    .find((step) => step.status === "completed")?.kind ?? "";

  return {
    stepCount: args.steps.length,
    lastSuccessfulStep,
    validationSummary: args.validation.summary,
    recoveryAttempts: args.recoveryAttempts ?? inferRecoveryAttempts(args.steps)
  };
}

export function buildBrowserRunSummary(args: {
  steps: DeliveryProofStep[];
  validation: BrowserValidation;
  recoveryAttempts?: number;
}) {
  const summary = summarizeBrowserWorkflow(args);
  return [
    `steps: ${summary.stepCount}`,
    `last_successful_step: ${summary.lastSuccessfulStep || "none"}`,
    `validation: ${summary.validationSummary}`,
    `recovery_attempts: ${summary.recoveryAttempts}`
  ].join("\n");
}

function inferRecoveryAttempts(steps: DeliveryProofStep[]) {
  return steps.filter((step) => step.status === "blocked" || step.status === "failed").length;
}
