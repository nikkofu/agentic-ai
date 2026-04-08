import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { getRuntimeConfig } from "../../src/config/loadRuntimeConfig";

describe("runtimeConfig layering", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-test-"));
  const basePath = path.join(tempDir, "runtime.yaml");
  const localPath = path.join(tempDir, "runtime.local.yaml");

  afterEach(() => {
    if (fs.existsSync(basePath)) fs.unlinkSync(basePath);
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    delete process.env.RUNTIME_CONFIG_LOCAL_PATH;
    delete process.env.OPENROUTER_DEFAULT_MODEL;
  });

  it("loads base config when no local exists", () => {
    fs.writeFileSync(
      basePath,
      `models:
  default: "nvidia/nemotron-3-super-120b-a12b:free"
  by_agent_role:
    planner: "nvidia/nemotron-3-super-120b-a12b:free"
    researcher: "nvidia/nemotron-3-super-120b-a12b:free"
    coder: "nvidia/nemotron-3-super-120b-a12b:free"
    writer: "nvidia/nemotron-3-super-120b-a12b:free"
reasoner:
  default: "medium"
  by_agent_role:
    planner: "high"
    researcher: "high"
    coder: "medium"
    writer: "low"
scheduler:
  default_policy: "bfs"
  policy_overrides: {}
guardrails:
  max_depth: 4
  max_branch: 3
  max_steps: 60
  max_budget: 5
evaluator:
  weights:
    quality: 0.6
    cost: 0.2
    latency: 0.2
retry:
  max_retries: 3
  base_delay_ms: 1000
`
    );

    const config = getRuntimeConfig(basePath);
    expect(config.models.default).toBe("nvidia/nemotron-3-super-120b-a12b:free");
  });

  it("layers local config over base", () => {
    fs.writeFileSync(
      basePath,
      `models:
  default: "nvidia/nemotron-3-super-120b-a12b:free"
  by_agent_role:
    planner: "nvidia/nemotron-3-super-120b-a12b:free"
    researcher: "nvidia/nemotron-3-super-120b-a12b:free"
    coder: "nvidia/nemotron-3-super-120b-a12b:free"
    writer: "nvidia/nemotron-3-super-120b-a12b:free"
reasoner:
  default: "medium"
  by_agent_role:
    planner: "high"
    researcher: "high"
    coder: "medium"
    writer: "low"
scheduler:
  default_policy: "bfs"
  policy_overrides: {}
guardrails:
  max_depth: 4
  max_branch: 3
  max_steps: 60
  max_budget: 5
evaluator:
  weights:
    quality: 0.6
    cost: 0.2
    latency: 0.2
retry:
  max_retries: 3
  base_delay_ms: 1000
`
    );

    fs.writeFileSync(localPath, `models:\n  default: "openai/gpt-4o-mini"`);
    process.env.RUNTIME_CONFIG_LOCAL_PATH = localPath;

    const config = getRuntimeConfig(basePath);
    expect(config.models.default).toBe("openai/gpt-4o-mini");
    // Ensure nested unchanged values persist
    expect(config.reasoner.default).toBe("medium");
  });

  it("applies environment variable override over everything", () => {
    fs.writeFileSync(
      basePath,
      `models:
  default: "nvidia/nemotron-3-super-120b-a12b:free"
  by_agent_role:
    planner: "nvidia/nemotron-3-super-120b-a12b:free"
    researcher: "nvidia/nemotron-3-super-120b-a12b:free"
    coder: "nvidia/nemotron-3-super-120b-a12b:free"
    writer: "nvidia/nemotron-3-super-120b-a12b:free"
reasoner:
  default: "medium"
  by_agent_role:
    planner: "high"
    researcher: "high"
    coder: "medium"
    writer: "low"
scheduler:
  default_policy: "bfs"
  policy_overrides: {}
guardrails:
  max_depth: 4
  max_branch: 3
  max_steps: 60
  max_budget: 5
evaluator:
  weights:
    quality: 0.6
    cost: 0.2
    latency: 0.2
retry:
  max_retries: 3
  base_delay_ms: 1000
`
    );

    process.env.OPENROUTER_DEFAULT_MODEL = "openai/gpt-4.1-mini";

    const config = getRuntimeConfig(basePath);
    expect(config.models.default).toBe("openai/gpt-4.1-mini");
  });
});
