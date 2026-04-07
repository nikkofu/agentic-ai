import { z } from "zod";
export const eventSchemaRegistry = {
    TaskSubmitted: z.object({ task_id: z.string() }),
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
};
