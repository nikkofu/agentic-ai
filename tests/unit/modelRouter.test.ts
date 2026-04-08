import { describe, expect, it } from "vitest";

import { resolveModelRoute } from "../../src/model/modelRouter";
import type { RuntimeConfig } from "../../src/types/runtime";

const baseConfig: RuntimeConfig = {
  models: {
    default: "qwen/qwen3.6-plus:free",
    fallback: [],
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
  },
  retry: {
    max_retries: 3,
    base_delay_ms: 1000
  },
  mcp_servers: {},
  providers: {
    lmstudio: {
      base_url: "http://localhost:1234/v1",
      api_key_env: "LM_STUDIO_KEY"
    }
  }
};

describe("resolveModelRoute", () => {
  it("uses role-specific reasoner and model", () => {
    const route = resolveModelRoute(baseConfig, "planner", {});

    expect(route.model).toBe("qwen/qwen3.6-plus:free");
    expect(route.reasoner).toBe("high");
  });

  it("resolves custom provider with baseUrl and apiKey from env", () => {
    const config = {
      ...baseConfig,
      models: {
        ...baseConfig.models,
        default: "lmstudio/qwen2.5-7b",
        by_agent_role: {
          ...baseConfig.models.by_agent_role,
          planner: "lmstudio/qwen2.5-7b"
        }
      }
    };
    
    const route = resolveModelRoute(config, "planner", {
      LM_STUDIO_KEY: "sk-local-test"
    });

    expect(route.model).toBe("qwen2.5-7b");
    expect(route.baseUrl).toBe("http://localhost:1234/v1");
    expect(route.apiKey).toBe("sk-local-test");
  });

  it("falls back to default reasoner when role override missing", () => {
    const route = resolveModelRoute(baseConfig, "coder", {});
    expect(route.reasoner).toBe("low");
  });

  it("applies runtime environment override for default model", () => {
    const route = resolveModelRoute(baseConfig, "writer", {
      OPENROUTER_DEFAULT_MODEL: "qwen/qwen3.6-plus:free"
    });

    expect(route.model).toBe("qwen/qwen3.6-plus:free");
  });
});
