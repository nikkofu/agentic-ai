import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { getRuntimeConfig } from "../../src/config/loadRuntimeConfig";

describe("layered runtime config", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "runtime-config-test-"));

  afterEach(() => {
    delete process.env.OPENROUTER_DEFAULT_MODEL;
    delete process.env.RUNTIME_CONFIG_LOCAL_PATH;
  });

  it("loads defaults from runtime.yaml", () => {
    const basePath = path.join(tempRoot, "base-runtime.yaml");

    fs.writeFileSync(
      basePath,
      `models:\n  default: \"qwen/qwen3.6-plus:free\"\n  byAgentRole:\n    planner: \"qwen/qwen3.6-plus:free\"\n    researcher: \"qwen/qwen3.6-plus:free\"\n    coder: \"qwen/qwen3.6-plus:free\"\n    writer: \"qwen/qwen3.6-plus:free\"\nreasoner:\n  default: \"medium\"\n  byAgentRole:\n    planner: \"high\"\n    researcher: \"high\"\n    coder: \"medium\"\n    writer: \"low\"\nscheduler:\n  defaultPolicy: \"bfs\"\n  policyOverrides: {}\nguardrails:\n  maxDepth: 4\n  maxBranch: 3\n  maxSteps: 60\n  maxBudget: 5\nevaluator:\n  weights:\n    quality: 0.6\n    cost: 0.2\n    latency: 0.2\n`
    );

    const config = getRuntimeConfig(basePath);
    expect(config.models.default).toBe("qwen/qwen3.6-plus:free");
  });

  it("overrides defaults with local override yaml", () => {
    const basePath = path.join(tempRoot, "base-runtime-2.yaml");
    const localPath = path.join(tempRoot, "runtime.local.yaml");

    fs.writeFileSync(
      basePath,
      `models:\n  default: \"qwen/qwen3.6-plus:free\"\n  byAgentRole:\n    planner: \"qwen/qwen3.6-plus:free\"\n    researcher: \"qwen/qwen3.6-plus:free\"\n    coder: \"qwen/qwen3.6-plus:free\"\n    writer: \"qwen/qwen3.6-plus:free\"\nreasoner:\n  default: \"medium\"\n  byAgentRole:\n    planner: \"high\"\n    researcher: \"high\"\n    coder: \"medium\"\n    writer: \"low\"\nscheduler:\n  defaultPolicy: \"bfs\"\n  policyOverrides: {}\nguardrails:\n  maxDepth: 4\n  maxBranch: 3\n  maxSteps: 60\n  maxBudget: 5\nevaluator:\n  weights:\n    quality: 0.6\n    cost: 0.2\n    latency: 0.2\n`
    );

    fs.writeFileSync(localPath, `models:\n  default: \"minimax/minimax-m2.5:free\"\n`);
    process.env.RUNTIME_CONFIG_LOCAL_PATH = localPath;

    const config = getRuntimeConfig(basePath);
    expect(config.models.default).toBe("minimax/minimax-m2.5:free");
  });

  it("applies env override on top of yaml layers", () => {
    const basePath = path.join(tempRoot, "base-runtime-3.yaml");

    fs.writeFileSync(
      basePath,
      `models:\n  default: \"qwen/qwen3.6-plus:free\"\n  byAgentRole:\n    planner: \"qwen/qwen3.6-plus:free\"\n    researcher: \"qwen/qwen3.6-plus:free\"\n    coder: \"qwen/qwen3.6-plus:free\"\n    writer: \"qwen/qwen3.6-plus:free\"\nreasoner:\n  default: \"medium\"\n  byAgentRole:\n    planner: \"high\"\n    researcher: \"high\"\n    coder: \"medium\"\n    writer: \"low\"\nscheduler:\n  defaultPolicy: \"bfs\"\n  policyOverrides: {}\nguardrails:\n  maxDepth: 4\n  maxBranch: 3\n  maxSteps: 60\n  maxBudget: 5\nevaluator:\n  weights:\n    quality: 0.6\n    cost: 0.2\n    latency: 0.2\n`
    );

    process.env.OPENROUTER_DEFAULT_MODEL = "openai/gpt-4.1-mini";

    const config = getRuntimeConfig(basePath);
    expect(config.models.default).toBe("openai/gpt-4.1-mini");
  });
});
