import { z } from "zod";
export const agentRoleSchema = z.enum(["planner", "researcher", "coder", "writer"]);
export const schedulerPolicySchema = z.enum(["bfs", "dfs"]);
export const runtimeConfigSchema = z.object({
    models: z.object({
        default: z.string(),
        fallback: z.array(z.string()).default([]),
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
