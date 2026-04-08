import type { DagNode, DagWorkflow } from "../types/dag";
import type { ExecutionContext, PlannerPolicy, RetrievalSnippet, TaskIntent } from "./contracts";

export type { ExecutionContext };

export function createExecutionContext(args: {
  intent: TaskIntent | null;
  plan: DagWorkflow | null;
  policy?: PlannerPolicy;
  node: DagNode;
  task: string;
  dependencyOutputs?: string[];
  memoryRefs?: string[];
  workingMemory?: string[];
  retrievalContext?: RetrievalSnippet[];
}): ExecutionContext {
  return {
    intent: args.intent,
    plan: args.plan,
    policy: args.policy,
    node: args.node,
    task: args.task,
    dependencyOutputs: args.dependencyOutputs ?? [],
    memoryRefs: args.memoryRefs ?? [],
    workingMemory: args.workingMemory ?? [],
    retrievalContext: args.retrievalContext ?? []
  };
}
