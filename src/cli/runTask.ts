import { createInterface } from "node:readline/promises";
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
  repl?: boolean;
  verbose?: boolean;
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

  if (args.verbose) {
    eventBus.subscribe("*", (event) => {
      const key = event.payload.task_id ?? event.payload.node_id ?? "-";
      console.log(`[${new Date(event.ts).toISOString()}] ${event.type} key=${String(key)}`);
    });
  }

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
      fallbackModels: config.models.fallback,
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

export function parseRunTaskArgs(argv: string[]): RunTaskInput {
  const inputArgIndex = argv.findIndex((arg) => arg === "--input" || arg === "-p");
  const input = inputArgIndex >= 0 ? argv[inputArgIndex + 1] ?? "" : "";
  const verbose = argv.includes("--verbose");
  const repl = argv.includes("--repl");

  return { input, verbose, repl };
}

export function processReplCommand(line: string):
  | { action: "approve" }
  | { action: "reject" }
  | { action: "exit" }
  | { action: "prompt"; prompt: string }
  | { action: "noop" } {
  const input = line.trim();

  if (input === "/approve") {
    return { action: "approve" };
  }

  if (input === "/reject") {
    return { action: "reject" };
  }

  if (input === "/exit") {
    return { action: "exit" };
  }

  if (input.length === 0) {
    return { action: "noop" };
  }

  return { action: "prompt", prompt: input };
}

async function runReplSession(verbose: boolean): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    while (true) {
      const line = (await rl.question("agentic> ")).trim();

      const command = processReplCommand(line);

      if (command.action === "exit") {
        break;
      }

      if (command.action === "approve") {
        console.log("revise approved");
        continue;
      }

      if (command.action === "reject") {
        console.log("revise rejected");
        continue;
      }

      if (command.action === "noop") {
        continue;
      }

      const output = await runTask({ input: command.prompt, verbose });
      process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    }
  } finally {
    rl.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const parsed = parseRunTaskArgs(process.argv.slice(2));

  const run = parsed.repl ? runReplSession(parsed.verbose ?? false) : runTask(parsed);

  run
    .then((output) => {
      process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    });
}
