import type { DagNode, DagWorkflow } from "../types/dag";
import type { TaskIntent } from "./intent";
import type { PlannerPolicy } from "./policy";

export type ExecutionContext = {
  intent: TaskIntent | null;
  plan: DagWorkflow | null;
  policy?: PlannerPolicy;
  node: DagNode;
  task: string;
  dependencyOutputs: string[];
  memoryRefs: string[];
};

export function createExecutionContext(args: {
  intent: TaskIntent | null;
  plan: DagWorkflow | null;
  policy?: PlannerPolicy;
  node: DagNode;
  task: string;
  dependencyOutputs?: string[];
  memoryRefs?: string[];
}): ExecutionContext {
  return {
    intent: args.intent,
    plan: args.plan,
    policy: args.policy,
    node: args.node,
    task: args.task,
    dependencyOutputs: args.dependencyOutputs ?? [],
    memoryRefs: args.memoryRefs ?? []
  };
}
