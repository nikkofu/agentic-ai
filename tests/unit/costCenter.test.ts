import { describe, it, expect } from 'vitest';
import { CostCenter } from '../../src/core/costCenter.js';

describe('CostCenter', () => {
  const costCenter = new CostCenter();

  it('应该能正确计算免费模型的费用 (qwen/qwen3.6-plus:free)', () => {
    const usage = {
      prompt_tokens: 1000,
      completion_tokens: 500,
      total_tokens: 1500
    };
    const cost = costCenter.calculateCost('qwen/qwen3.6-plus:free', usage);
    expect(cost).toBe(0);
  });

  it('应该能正确计算 openai/gpt-4o-mini 的费用', () => {
    // prompt: 0.15 / 1M tokens, completion: 0.6 / 1M tokens
    const usage = {
      prompt_tokens: 1_000_000, // 应该计费 0.15
      completion_tokens: 2_000_000, // 应该计费 1.2
      total_tokens: 3_000_000
    };
    const cost = costCenter.calculateCost('openai/gpt-4o-mini', usage);
    expect(cost).toBeCloseTo(1.35, 4);
  });

  it('应该能正确计算 anthropic/claude-3-5-sonnet 的费用', () => {
    // prompt: 3 / 1M tokens, completion: 15 / 1M tokens
    const usage = {
      prompt_tokens: 100_000, // 应该计费 0.3
      completion_tokens: 10_000, // 应该计费 0.15
      total_tokens: 110_000
    };
    const cost = costCenter.calculateCost('anthropic/claude-3-5-sonnet', usage);
    expect(cost).toBeCloseTo(0.45, 4);
  });

  it('当模型不在表中时，应默认返回 0', () => {
    const usage = {
      prompt_tokens: 1000,
      completion_tokens: 500,
      total_tokens: 1500
    };
    const cost = costCenter.calculateCost('unknown-model', usage);
    expect(cost).toBe(0);
  });
});
