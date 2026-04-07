import type { AgentRole, RuntimeConfig } from "../types/runtime";

export type ModelRoute = {
  model: string;
  reasoner: string;
};

export function resolveModelRoute(
  config: RuntimeConfig,
  role: AgentRole,
  env: Record<string, string | undefined> = process.env
): ModelRoute {
  const modelOverride = env.OPENROUTER_DEFAULT_MODEL;
  const model = modelOverride ?? config.models.byAgentRole[role] ?? config.models.default;

  const reasoner = config.reasoner.byAgentRole[role] ?? config.reasoner.default;

  return {
    model,
    reasoner
  };
}
