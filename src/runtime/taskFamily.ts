import type { TaskIntent } from "./contracts";
import type { TaskFamily, TaskFamilyPolicy } from "./contracts";

export type { TaskFamily, TaskFamilyPolicy } from "./contracts";

export const TASK_FAMILIES = ["research_writing", "browser_workflow", "competitive_research", "content_pipeline"] as const;

export function normalizeTaskFamily(value: unknown): TaskFamily | null {
  return value === "research_writing" ||
    value === "browser_workflow" ||
    value === "competitive_research" ||
    value === "content_pipeline"
    ? value
    : null;
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
        sourceCoverageMinimum: 2
      };
    case "browser_workflow":
      return {
        family,
        automationPriority: "high",
        trustPriority: "medium",
        requireVerification: true,
        requireArtifacts: true
      };
    case "competitive_research":
      return {
        family,
        automationPriority: "medium",
        trustPriority: "high",
        requireVerification: true,
        requireArtifacts: true,
        sourceCoverageMinimum: 2
      };
    case "content_pipeline":
      return {
        family,
        automationPriority: "medium",
        trustPriority: "high",
        requireVerification: true,
        requireArtifacts: true
      };
  }
}

export function inferTaskFamily(args: {
  intent?: Pick<TaskIntent, "task_kind"> | null;
  task?: string;
}): TaskFamily | undefined {
  const taskKind = normalizeTaskFamily(args.intent?.task_kind);
  if (taskKind) {
    return taskKind;
  }

  if (args.intent) {
    return undefined;
  }

  const task = (args.task ?? "").toLowerCase();
  if (matchesResearchTask(task)) {
    return "research_writing";
  }

  if (matchesCompetitiveResearchTask(task)) {
    return "competitive_research";
  }

  if (matchesContentPipelineTask(task)) {
    return "content_pipeline";
  }

  if (matchesBrowserTask(task)) {
    return "browser_workflow";
  }

  return undefined;
}

function matchesResearchTask(task: string): boolean {
  return /research|article|summary|report|citation|source|analysis|paper|essay|literature|study/.test(task);
}

function matchesCompetitiveResearchTask(task: string): boolean {
  return /competitive|competitor|compare|comparison|vs\.?|versus|market landscape|positioning|benchmark/.test(task);
}

function matchesContentPipelineTask(task: string): boolean {
  return /content package|content pipeline|channel variants|production plan|content brief|content calendar|outline.+primary draft|primary draft.+outline/.test(task);
}

function matchesBrowserTask(task: string): boolean {
  return /browser|website|web app|click|submit|form|log in|login|navigate|select|fill|checkout|book|reserve/.test(task);
}
