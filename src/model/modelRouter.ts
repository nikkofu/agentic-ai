import type { AgentRole, RuntimeConfig } from "../types/runtime";

export type ModelRoute = {
  model: string;
  reasoner: string;
  baseUrl?: string;
  apiKey?: string;
};

export function resolveModelRoute(
  config: RuntimeConfig,
  role: AgentRole,
  env: Record<string, string | undefined> = process.env
): ModelRoute {
  const modelOverride = env.OPENROUTER_DEFAULT_MODEL;
  const rawModel = modelOverride ?? config.models.by_agent_role[role] ?? config.models.default;

  const reasoner = config.reasoner.by_agent_role[role] ?? config.reasoner.default;

  // Check for provider prefix (e.g., "lmstudio/qwen2.5-7b")
  const parts = rawModel.split("/");
  if (parts.length > 1) {
    const providerName = parts[0];
    const provider = config.providers?.[providerName];
    if (provider) {
      const modelName = parts.slice(1).join("/");
      return {
        model: modelName,
        reasoner,
        baseUrl: provider.base_url,
        apiKey: env[provider.api_key_env]
      };
    }
  }

  // Default to OpenRouter behavior if no custom provider matched
  return {
    model: rawModel,
    reasoner,
    apiKey: env.OPENROUTER_API_KEY
  };
}
