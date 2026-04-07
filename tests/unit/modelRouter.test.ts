import { describe, expect, it } from "vitest";

import { resolveModelRoute } from "../../src/model/modelRouter";
import type { RuntimeConfig } from "../../src/types/runtime";

const baseConfig: RuntimeConfig = {
  models: {
    default: "qwen/qwen3.6-plus:free",
    byAgentRole: {
      planner: "qwen/qwen3.6-plus:free",
      researcher: "qwen/qwen3.6-plus:free",
      coder: "qwen/qwen3.6-plus:free",
      writer: "qwen/qwen3.6-plus:free"
    }
  },
  reasoner: {
    default: "low",
    byAgentRole: {
      planner: "high",
      researcher: "low",
      coder: "low",
      writer: "low"
    }
  },
  scheduler: {
    defaultPolicy: "bfs",
    policyOverrides: {}
  },
  guardrails: {
    maxDepth: 4,
    maxBranch: 3,
    maxSteps: 60,
    maxBudget: 5
  },
  evaluator: {
    weights: {
      quality: 0.6,
      cost: 0.2,
      latency: 0.2
    }
  }
};

describe("resolveModelRoute", () => {
  it("uses role-specific reasoner and model", () => {
    const route = resolveModelRoute(baseConfig, "planner");

    expect(route.model).toBe("qwen/qwen3.6-plus:free");
    expect(route.reasoner).toBe("high");
  });

  it("falls back to default reasoner when role override missing", () => {
    const config: RuntimeConfig = {
      ...baseConfig,
      reasoner: {
        default: "low",
        byAgentRole: {
          planner: "high",
          researcher: "low",
          coder: "low",
          writer: "low"
        }
      }
    };

    const route = resolveModelRoute(config, "coder");
    expect(route.reasoner).toBe("low");
  });

  it("applies runtime environment override for default model", () => {
    const route = resolveModelRoute(baseConfig, "writer", {
      OPENROUTER_DEFAULT_MODEL: "qwen/qwen3.6-plus:free"
    });

    expect(route.model).toBe("qwen/qwen3.6-plus:free");
  });
});
