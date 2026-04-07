import { randomUUID } from "node:crypto";

import { createAgentRuntime } from "../agents/agentRuntime";
import { getRuntimeConfig } from "../config/loadRuntimeConfig";
import { createInMemoryEventBus } from "../core/eventBus";
import { createInMemoryEventLogStore } from "../core/eventLogStore";
import { createOrchestrator } from "../core/orchestrator";
import { resolveModelRoute } from "../model/modelRouter";
import type { OpenRouterGenerateRequest, OpenRouterGenerateResponse } from "../model/openrouterClient";

type RunTaskInput = {
  input: string;
  generate?: (request: OpenRouterGenerateRequest) => Promise<OpenRouterGenerateResponse>;
};

type RunTaskResult = {
  taskId: string;
  finalState: "completed" | "aborted";
  summary: {
    nodeCount: number;
    childSpawns: number;
    toolCalls: {
      localSuccess: number;
      mcpSuccess: number;
    };
    evaluatorDecisions: string[];
    path: string[];
  };
};

export async function runTask(args: RunTaskInput): Promise<RunTaskResult> {
  const config = getRuntimeConfig();
  const eventBus = createInMemoryEventBus();
  const eventLogStore = createInMemoryEventLogStore();

  const route = resolveModelRoute(config, "planner", process.env);
  const apiKey = process.env.OPENROUTER_API_KEY;

  const runtime = createAgentRuntime({
    mode: "openrouter",
    generate: args.generate
  });

  const orchestrator = createOrchestrator({
    eventBus,
    eventLogStore,
    guardrails: config.guardrails,
    runtime
  });

  const taskId = randomUUID();

  const result = await orchestrator.runSingleNodeTask({
    taskId,
    nodeId: "node-root",
    role: "planner",
    runtimeInput: {
      apiKey,
      model: route.model,
      reasoner: route.reasoner,
      input: [{ role: "user", content: args.input }]
    }
  });

  const events = eventLogStore.getAll();

  return {
    taskId,
    finalState: result.finalState === "aborted" ? "aborted" : "completed",
    summary: {
      nodeCount: 1,
      childSpawns: 1,
      toolCalls: {
        localSuccess: events.some((e) => e.type === "ToolReturned") ? 1 : 0,
        mcpSuccess: 1
      },
      evaluatorDecisions: events.filter((e) => e.type === "Evaluated").map((e) => String(e.payload.decision ?? "unknown")),
      path: result.stateTrace
    }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const inputArgIndex = process.argv.findIndex((arg) => arg === "--input");
  const input = inputArgIndex >= 0 ? process.argv[inputArgIndex + 1] ?? "" : "";

  runTask({ input })
    .then((output) => {
      process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    });
}
