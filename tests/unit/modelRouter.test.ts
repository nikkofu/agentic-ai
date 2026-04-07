import { describe, expect, it } from "vitest";

import { resolveModelRoute } from "../../src/model/modelRouter";
import type { RuntimeConfig } from "../../src/types/runtime";

const baseConfig: RuntimeConfig = {
  models: {
    default: "qwen/qwen3.6-plus:free",
    by_agent_role: {
      planner: "qwen/qwen3.6-plus:free",
      researcher: "qwen/qwen3.6-plus:free",
      coder: "qwen/qwen3.6-plus:free",
      writer: "qwen/qwen3.6-plus:free"
    }
  },
  reasoner: {
    default: "low",
    by_agent_role: {
      planner: "high",
      researcher: "low",
      coder: "low",
      writer: "low"
    }
  },
  scheduler: {
    default_policy: "bfs",
    policy_overrides: {}
  },
  guardrails: {
    max_depth: 4,
    max_branch: 3,
    max_steps: 60,
    max_budget: 5
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
    const route = resolveModelRoute(baseConfig, "planner", {});

    expect(route.model).toBe("qwen/qwen3.6-plus:free");
    expect(route.reasoner).toBe("high");
  });

  it("falls back to default reasoner when role override missing", () => {
    const config: RuntimeConfig = {
      ...baseConfig,
      reasoner: {
        default: "low",
        by_agent_role: {
          planner: "high",
          researcher: "low",
          coder: "low",
          writer: "low"
        }
      }
    };

    const route = resolveModelRoute(config, "coder", {});
    expect(route.reasoner).toBe("low");
  });

  it("applies runtime environment override for default model", () => {
    const route = resolveModelRoute(baseConfig, "writer", {
      OPENROUTER_DEFAULT_MODEL: "qwen/qwen3.6-plus:free"
    });

    expect(route.model).toBe("qwen/qwen3.6-plus:free");
  });

  it("ignores ambient process.env when explicit env is empty", () => {
    const previous = process.env.OPENROUTER_DEFAULT_MODEL;
    process.env.OPENROUTER_DEFAULT_MODEL = "minimax/minimax-m2.5:free";

    const route = resolveModelRoute(baseConfig, "planner", {});

    expect(route.model).toBe("qwen/qwen3.6-plus:free");

    if (previous === undefined) {
      delete process.env.OPENROUTER_DEFAULT_MODEL;
    } else {
      process.env.OPENROUTER_DEFAULT_MODEL = previous;
    }
  });
});
