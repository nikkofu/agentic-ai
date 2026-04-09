import type { TaskIntent } from "./contracts";
import type { TaskFamily, TaskFamilyPolicy } from "./contracts";

export type { TaskFamily, TaskFamilyPolicy } from "./contracts";

export const TASK_FAMILIES = ["research_writing", "browser_workflow"] as const;

export function normalizeTaskFamily(value: unknown): TaskFamily | null {
  return value === "research_writing" || value === "browser_workflow" ? value : null;
}

export function buildTaskFamilyPolicy(family: TaskFamily): TaskFamilyPolicy {
  switch (family) {
    case "research_writing":
      return {
        family,
        automationPriority: "low",
        trustPriority: "high",
        requireVerification: true,
        requireArtifacts: true,
        sourceCoverageMinimum: 2,
        browserRecoveryBudget: 0
      };
    case "browser_workflow":
      return {
        family,
        automationPriority: "high",
        trustPriority: "medium",
        requireVerification: true,
        requireArtifacts: true,
        browserRecoveryBudget: 3,
        sourceCoverageMinimum: 1
      };
  }
}

export function inferTaskFamily(args: {
  intent?: Pick<TaskIntent, "task_kind"> | null;
  task?: string;
  workflow?: unknown;
}): TaskFamily | undefined {
  const taskKind = normalizeTaskFamily(args.intent?.task_kind);
  if (taskKind) {
    return taskKind;
  }

  const task = (args.task ?? "").toLowerCase();
  if (matchesResearchTask(task)) {
    return "research_writing";
  }

  if (args.workflow || matchesBrowserTask(task)) {
    return "browser_workflow";
  }

  return undefined;
}

function matchesResearchTask(task: string): boolean {
  return /research|write|article|summary|report|citation|source|verify|analysis|review/.test(task);
}

function matchesBrowserTask(task: string): boolean {
  return /browser|website|web app|click|submit|form|log in|login|navigate|select|fill|checkout|book|reserve/.test(task);
}
