import { z } from "zod";

export const agentRoleSchema = z.enum(["planner", "researcher", "coder", "writer"]);
export type AgentRole = z.infer<typeof agentRoleSchema>;

export const schedulerPolicySchema = z.enum(["bfs", "dfs"]);
export type SchedulerPolicy = z.infer<typeof schedulerPolicySchema>;

export const runtimeConfigSchema = z.object({
  models: z.object({
    default: z.string(),
    byAgentRole: z.record(agentRoleSchema, z.string())
  }),
  reasoner: z.object({
    default: z.string(),
    byAgentRole: z.record(agentRoleSchema, z.string())
  }),
  scheduler: z.object({
    defaultPolicy: schedulerPolicySchema,
    policyOverrides: z.record(z.string(), schedulerPolicySchema)
  }),
  guardrails: z.object({
    maxDepth: z.number().int().nonnegative(),
    maxBranch: z.number().int().nonnegative(),
    maxSteps: z.number().int().nonnegative(),
    maxBudget: z.number().nonnegative()
  }),
  evaluator: z.object({
    weights: z.object({
      quality: z.number().min(0).max(1),
      cost: z.number().min(0).max(1),
      latency: z.number().min(0).max(1)
    })
  })
});

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

export type TaskGraph = {
  taskId: string;
  rootNodeId: string;
  frontier: string[];
  nodes: Record<string, TaskNode>;
  status: "running" | "completed" | "failed" | "aborted";
  createdAt: string;
};

export type TaskNode = {
  nodeId: string;
  parentNodeId?: string;
  role: AgentRole;
  state: "pending" | "running" | "waiting_tool" | "evaluating" | "completed" | "failed" | "aborted";
  depth: number;
  attempt: number;
  inputSummary: string;
  outputSummary?: string;
  children: string[];
  metrics?: {
    qualityScore?: number;
    costScore?: number;
    latencyScore?: number;
    totalScore?: number;
    latencyMs?: number;
    costUsd?: number;
  };
};

export type EvalDecision = {
  decision: "continue" | "revise" | "stop" | "escalate";
  reason: string;
  scores: {
    quality: number;
    cost: number;
    latency: number;
    total: number;
  };
};
