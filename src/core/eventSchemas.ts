import { z } from "zod";

export const eventSchemaRegistry = {
  TaskSubmitted: z.object({ task_id: z.string() }),
  IntentClassified: z.object({ task_id: z.string(), task_kind: z.string(), execution_mode: z.string() }),
  PlannerExpanded: z.object({
    task_id: z.string(),
    child_count: z.number().int().nonnegative(),
    recommended_tools: z.array(z.string()).optional(),
    required_capabilities: z.array(z.string()).optional(),
    verification_policy: z.string().optional()
  }),
  NodeScheduled: z.object({ task_id: z.string(), node_id: z.string() }),
  AgentStarted: z.object({ task_id: z.string(), node_id: z.string(), role: z.string() }),
  PromptComposed: z.object({ task_id: z.string(), node_id: z.string() }),
  ModelCalled: z.object({ task_id: z.string(), node_id: z.string() }),
  ToolInvoked: z.object({ task_id: z.string(), node_id: z.string(), tool: z.string() }),
  ToolReturned: z.object({ task_id: z.string(), node_id: z.string(), ok: z.boolean() }),
  Evaluated: z.object({ task_id: z.string(), node_id: z.string(), decision: z.string() }),
  NodeCompleted: z.object({ task_id: z.string(), node_id: z.string() }),
  TaskClosed: z.object({ task_id: z.string(), state: z.string() }),
  GuardrailTripped: z.object({ task_id: z.string(), node_id: z.string(), reason: z.string() })
} as const;

export type EventSchemaRegistry = typeof eventSchemaRegistry;
