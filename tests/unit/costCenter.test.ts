import { describe, it, expect } from 'vitest';
import { calculateCost } from '../../src/core/costCenter.js';

describe('CostCenter', () => {
  it('应该能正确计算免费模型的费用 (qwen/qwen3.6-plus:free)', () => {
    const usage = { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 };
    const cost = calculateCost('qwen/qwen3.6-plus:free', usage);
    expect(cost).toBe(0);
  });

  it('应该能正确计算 openai/gpt-4o-mini 的费用', () => {
    // prompt: $0.15/1M, completion: $0.6/1M
    const usage = { prompt_tokens: 1000000, completion_tokens: 1000000, total_tokens: 2000000 };
    const cost = calculateCost('openai/gpt-4o-mini', usage);
    expect(cost).toBe(0.15 + 0.6);
  });

  it('应该能正确计算 anthropic/claude-3-5-sonnet 的费用', () => {
    // prompt: $3/1M, completion: $15/1M
    const usage = { prompt_tokens: 1000000, completion_tokens: 1000000, total_tokens: 2000000 };
    const cost = calculateCost('anthropic/claude-3-5-sonnet', usage);
    expect(cost).toBe(3 + 15);
  });

  it('对于未知模型应该返回 0', () => {
    const usage = { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 };
    const cost = calculateCost('unknown-model', usage);
    expect(cost).toBe(0);
  });
});
