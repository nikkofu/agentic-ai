import { z } from "zod";

export const agentRoleSchema = z.enum(["planner", "researcher", "coder", "writer"]);
export type AgentRole = z.infer<typeof agentRoleSchema>;

export const schedulerPolicySchema = z.enum(["bfs", "dfs"]);
export type SchedulerPolicy = z.infer<typeof schedulerPolicySchema>;

const memoryLayerStorageSchema = z.enum(["repo", "user_home"]);
const memoryAutomationModeSchema = z.enum(["full_auto", "assisted", "manual"]);
const sensitivityFilterSchema = z.enum(["strict", "balanced", "off"]);

const memoryLayerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  storage: memoryLayerStorageSchema,
  auto_record: z.boolean().default(true),
  auto_curate: z.boolean().default(true),
  auto_compress: z.boolean().default(true),
  sensitivity_filter: sensitivityFilterSchema.optional(),
  sync_to_repo: z.boolean().optional(),
  retain_days: z.number().int().positive().optional()
});

const memoryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  automation: memoryAutomationModeSchema.default("full_auto"),
  personal: memoryLayerConfigSchema.default({
    enabled: true,
    storage: "user_home",
    auto_record: true,
    auto_curate: true,
    auto_compress: true,
    sensitivity_filter: "strict"
  }),
  project: memoryLayerConfigSchema.default({
    enabled: true,
    storage: "repo",
    auto_record: true,
    auto_curate: true,
    auto_compress: true,
    sync_to_repo: true
  }),
  task: memoryLayerConfigSchema.default({
    enabled: true,
    storage: "repo",
    auto_record: true,
    auto_curate: true,
    auto_compress: true,
    retain_days: 30
  }),
  retrieval: z.object({
    inject_personal_compressed: z.boolean().default(true),
    inject_project_compressed: z.boolean().default(true),
    inject_task_curated: z.boolean().default(true),
    max_items_per_layer: z.number().int().positive().default(5)
  }).default({
    inject_personal_compressed: true,
    inject_project_compressed: true,
    inject_task_curated: true,
    max_items_per_layer: 5
  })
});

const dreamConfigSchema = z.object({
  enabled: z.boolean().default(true),
  mode: z.enum(["background", "manual"]).default("background"),
  idle_threshold_minutes: z.number().int().positive().default(20),
  auto_reflect: z.boolean().default(true),
  auto_compress_memory: z.boolean().default(true),
  auto_generate_skills: z.boolean().default(true),
  auto_reorder_backlog: z.boolean().default(true),
  auto_generate_hypotheses: z.boolean().default(true),
  allow_external_actions: z.boolean().default(false),
  allow_code_changes: z.boolean().default(false),
  allow_network_execution: z.boolean().default(false),
  allow_message_sending: z.boolean().default(false)
});

export const runtimeConfigSchema = z.object({
  models: z.object({
    default: z.string(),
    fallback: z.array(z.string()).default([]),
    by_agent_role: z.record(agentRoleSchema, z.string()),
    embeddings: z.object({
      default: z.string()
    }).default({
      default: "nvidia/llama-nemotron-embed-vl-1b-v2:free"
    })
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
  memory: memoryConfigSchema.optional(),
  dream: dreamConfigSchema.optional(),
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
  decision: "deliver" | "revise" | "block";
  reason: string;
  scores: {
    quality: number;
    cost: number;
    latency: number;
    total: number;
  };
};

export type ToolIntent = {
  transport: "local" | "mcp";
  tool: string;
  input: unknown;
};

export type DeliveryBundle = {
  status: "completed" | "partial" | "failed" | "blocked";
  final_result: string;
  artifacts: string[];
  verification: string[];
  risks: string[];
  blocking_reason?: string;
  next_actions: string[];
};
