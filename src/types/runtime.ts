import { z } from "zod";

export const agentRoleSchema = z.enum(["planner", "researcher", "coder", "writer"]);
export type AgentRole = z.infer<typeof agentRoleSchema>;

export const schedulerPolicySchema = z.enum(["bfs", "dfs"]);
export type SchedulerPolicy = z.infer<typeof schedulerPolicySchema>;

export const runtimeConfigSchema = z.object({
  models: z.object({
    default: z.string(),
    fallback: z.array(z.string()).default([]),
    by_agent_role: z.record(agentRoleSchema, z.string())
  }),
  reasoner: z.object({
    default: z.string(),
    by_agent_role: z.record(agentRoleSchema, z.string())
  }),
  scheduler: z.object({
    default_policy: schedulerPolicySchema,
    policy_overrides: z.record(z.string(), schedulerPolicySchema),
    rate_limit: z.object({
      requests_per_minute: z.number().int().positive(),
      burst_capacity: z.number().int().positive()
    }).optional()
  }),
  guardrails: z.object({
    max_depth: z.number().int().nonnegative(),
    max_branch: z.number().int().nonnegative(),
    max_steps: z.number().int().nonnegative(),
    max_budget: z.number().nonnegative()
  }),
  evaluator: z.object({
    weights: z.object({
      quality: z.number().min(0).max(1),
      cost: z.number().min(0).max(1),
      latency: z.number().min(0).max(1)
    })
  }),
  retry: z.object({
    max_retries: z.number().int().nonnegative().default(3),
    base_delay_ms: z.number().int().nonnegative().default(1000)
  }),
  providers: z.record(z.string(), z.object({
    base_url: z.string().url(),
    api_key_env: z.string()
  })).optional(),
  mcp_servers: z.record(z.string(), z.object({
    command: z.string(),
    args: z.array(z.string()).default([]),
    env: z.record(z.string(), z.string()).optional()
  })).default({})
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
