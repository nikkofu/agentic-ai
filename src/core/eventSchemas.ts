import { z } from "zod";

export const eventSchemaRegistry = {
  TaskSubmitted: z.object({ task_id: z.string(), resumed: z.boolean().optional() }),
  IntentClassified: z.object({ task_id: z.string(), task_kind: z.string(), execution_mode: z.string() }),
  PlannerExpanded: z.object({
    task_id: z.string(),
    child_count: z.number().int().nonnegative(),
    recommended_tools: z.array(z.string()).optional(),
    required_capabilities: z.array(z.string()).optional(),
    verification_policy: z.string().optional()
  }),
  ConversationLinked: z.object({
    task_id: z.string(),
    assistant_id: z.string(),
    thread_id: z.string(),
    thread_status: z.string(),
    channel_type: z.string(),
    external_user_id: z.string()
  }),
  NodeScheduled: z.object({ task_id: z.string(), node_id: z.string() }),
  AgentStarted: z.object({ task_id: z.string(), node_id: z.string(), role: z.string() }),
  PromptComposed: z.object({ task_id: z.string(), node_id: z.string() }),
  ModelCalled: z.object({ task_id: z.string(), node_id: z.string() }),
  InvalidOutputClassified: z.object({
    task_id: z.string(),
    node_id: z.string(),
    kind: z.string(),
    recoverable: z.boolean()
  }),
  ToolInvoked: z.object({ task_id: z.string(), node_id: z.string(), tool: z.string() }),
  ToolReturned: z.object({ task_id: z.string(), node_id: z.string(), ok: z.boolean() }),
  ExecutionContextPrepared: z.object({ task_id: z.string(), node_id: z.string(), context: z.any() }),
  TaskMemoryStored: z.object({ task_id: z.string(), source_id: z.string(), content: z.string(), tags: z.array(z.string()).optional() }),
  AsyncNodeQueued: z.object({
    task_id: z.string(),
    node_id: z.string(),
    role: z.string(),
    owner_id: z.string().optional(),
    dedupe_key: z.string().optional()
  }),
  AsyncNodeSettled: z.object({
    task_id: z.string(),
    node_id: z.string(),
    final_state: z.string(),
    owner_id: z.string().optional(),
    dedupe_key: z.string().optional(),
    delivery: z.any().optional(),
    final_result: z.string().optional(),
    blocking_reason: z.string().optional()
  }),
  AsyncNodeFailed: z.object({
    task_id: z.string(),
    node_id: z.string(),
    owner_id: z.string().optional(),
    dedupe_key: z.string().optional(),
    error: z.string()
  }),
  AsyncTaskSettled: z.object({
    task_id: z.string(),
    job_kind: z.string(),
    final_state: z.string(),
    delivery: z.any().optional()
  }),
  AsyncTaskFailed: z.object({
    task_id: z.string(),
    job_kind: z.string(),
    error: z.string()
  }),
  HumanActionRequired: z.object({
    task_id: z.string(),
    node_id: z.string(),
    reason: z.string().optional()
  }),
  HumanActionResolved: z.object({
    task_id: z.string(),
    node_id: z.string(),
    feedback: z.string()
  }),
  Evaluated: z.object({ task_id: z.string(), node_id: z.string(), decision: z.string() }),
  NodeCompleted: z.object({ task_id: z.string(), node_id: z.string() }),
  TaskClosed: z.object({
    task_id: z.string(),
    state: z.string(),
    resumed: z.boolean().optional(),
    delivery: z.any().optional(),
    final_result: z.string().optional(),
    artifacts: z.array(z.string()).optional(),
    blocking_reason: z.string().optional()
  }),
  GuardrailTripped: z.object({ task_id: z.string(), node_id: z.string(), reason: z.string() })
} as const;

export type EventSchemaRegistry = typeof eventSchemaRegistry;
