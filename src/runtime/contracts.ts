import type { DagNode, DagWorkflow } from "../types/dag";

export type AgentRole = DagNode["role"];

export type TaskIntent = {
  task_kind: string;
  execution_mode: "single_node" | "tree" | "dag" | "async";
  roles: AgentRole[];
  needs_verification: boolean;
  reason: string;
};

export type PlannerPolicy = {
  recommendedTools: string[];
  requiredCapabilities: string[];
  verificationPolicy: string;
};

export type PlannedWorkflow = DagWorkflow & PlannerPolicy;

export type RetrievalSnippet = {
  sourceId: string;
  content: string;
  relevance?: number;
};

export type ExecutionContext = {
  intent: TaskIntent | null;
  plan: DagWorkflow | null;
  policy?: PlannerPolicy;
  node: DagNode;
  task: string;
  dependencyOutputs: string[];
  memoryRefs: string[];
  workingMemory: string[];
  retrievalContext: RetrievalSnippet[];
};
