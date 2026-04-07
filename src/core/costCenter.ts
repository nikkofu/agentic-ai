import { LLMUsage } from "../model/openrouterClient";

/**
 * 内置模型价格（价格单位：USD/每百万 Token）
 */
export const MODEL_PRICING: Record<string, { prompt: number; completion: number }> = {
  'qwen/qwen3.6-plus:free': { prompt: 0, completion: 0 },
  'openai/gpt-4o-mini': { prompt: 0.15, completion: 0.6 },
  'anthropic/claude-3-5-sonnet': { prompt: 3, completion: 15 },
};

/**
 * 根据模型和使用量计算费用
 * @param model 模型标识符
 * @param usage LLM 使用详情
 * @returns 估计费用（USD）
 */
export function calculateCost(model: string, usage: LLMUsage): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    return 0;
  }

  const promptCost = (usage.prompt_tokens / 1_000_000) * pricing.prompt;
  const completionCost = (usage.completion_tokens / 1_000_000) * pricing.completion;

  return promptCost + completionCost;
}
