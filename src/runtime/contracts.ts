import type { DagNode, DagWorkflow } from "../types/dag";
import type { AgentRole } from "../types/runtime";
import type { DeliveryBundle } from "../types/runtime";

export const TASK_FAMILIES = ["research_writing", "browser_workflow"] as const;

export type TaskFamily = (typeof TASK_FAMILIES)[number];

export type TaskFamilyPolicy = {
  family: TaskFamily;
  automationPriority: "high" | "medium" | "low";
  trustPriority: "high" | "medium" | "low";
  requireVerification: boolean;
  requireArtifacts: boolean;
  sourceCoverageMinimum?: number;
};

export type DeliveryProofStep = {
  kind: string;
  status: "completed" | "failed" | "blocked";
  summary: string;
  evidenceRefs?: string[];
};

export type DeliveryProof = {
  family: TaskFamily;
  steps: DeliveryProofStep[];
  replayHints?: string[];
};

export type VerificationRecord = {
  kind: "source" | "page_state" | "form_result" | "artifact_check";
  summary: string;
  passed: boolean;
  sourceId?: string;
  locator?: string;
};

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
  family?: TaskFamily;
  familyPolicy?: TaskFamilyPolicy;
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

export type FamilyDeliveryBundle = Omit<DeliveryBundle, "verification"> & {
  family: TaskFamily;
  verification: VerificationRecord[];
  delivery_proof: DeliveryProof;
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
