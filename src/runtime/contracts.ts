import type { DagNode, DagWorkflow } from "../types/dag";
import type { AgentRole } from "../types/runtime";

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
  maxRevisions?: number;
  requireArtifacts?: boolean;
};

export type PlannedWorkflow = DagWorkflow & PlannerPolicy;

export type RetrievalSnippet = {
  sourceId: string;
  content: string;
  relevance?: number;
};

export type JoinDecision = "deliver" | "revise_child" | "spawn_more" | "block" | "queued";

export type InvalidOutputKind =
  | "empty_delivery"
  | "invalid_protocol"
  | "semantic_tool_loop"
  | "verification_missing"
  | "policy_tool_not_allowed";

export type InvalidOutputClassification = {
  kind: InvalidOutputKind;
  recoverable: boolean;
};

export type ExecutionContext = {
  intent: TaskIntent | null;
  plan: DagWorkflow | null;
  policy?: PlannerPolicy;
  node: Omit<DagNode, "role"> & { role: AgentRole };
  task: string;
  dependencyOutputs: string[];
  memoryRefs: string[];
  workingMemory: string[];
  retrievalContext: RetrievalSnippet[];
};
