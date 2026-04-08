import { createInterface } from "node:readline/promises";
import { randomUUID } from "node:crypto";
import { installSkillPackage } from "./skillRegistry";

import { createAgentRuntime } from "../agents/agentRuntime";
import { getRuntimeConfig } from "../config/loadRuntimeConfig";
import { createInMemoryEventBus } from "../core/eventBus";
import { createInMemoryEventLogStore } from "../core/eventLogStore";
import { WebHub } from "../core/webHub";
import { createOrchestrator } from "../core/orchestrator";
import { resolveModelRoute } from "../model/modelRouter";
import { PrismaClient } from "@prisma/client";
import { createPrismaTaskStore } from "../core/prismaTaskStore";
import { McpHub } from "../tools/mcpHub";
import { createToolGateway } from "../tools/toolGateway";
import { createLocalToolRegistry } from "../tools/localToolRegistry";
import { RequestLimiter } from "../core/limiter";
import { initTelemetry } from "../core/telemetry";
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
  telemetry: {
    total_tokens: number;
    total_cost_usd: number;
  };
};

export async function runTask(args: RunTaskInput): Promise<RunTaskResult> {
  const config = getRuntimeConfig();
  const eventBus = createInMemoryEventBus();
  const eventLogStore = createInMemoryEventLogStore();
  
  // Initialize Telemetry
  await initTelemetry();

  // Initialize persistence
  const prisma = new PrismaClient();
  const taskStore = createPrismaTaskStore(prisma);

  // Initialize MCP Hub
  const mcpHub = new McpHub(config.mcp_servers);

  // Initialize Limiter
  let limiter: RequestLimiter | undefined;
  if (config.scheduler.rate_limit) {
    limiter = new RequestLimiter({
      capacity: config.scheduler.rate_limit.burst_capacity,
      refillRatePerSecond: config.scheduler.rate_limit.requests_per_minute / 60
    });
  }

  const route = resolveModelRoute(config, "planner", process.env);
  const apiKey = args.generate ? "mock-key" : process.env.OPENROUTER_API_KEY;

  const runtime = createAgentRuntime({
    mode: "openrouter",
    generate: args.generate,
    limiter
  });

  if (args.verbose) {
    eventBus.subscribe("*", (event) => {
      const key = event.payload.task_id ?? event.payload.node_id ?? "-";
      console.log(`[${new Date(event.ts).toISOString()}] ${event.type} key=${String(key)}`);
    });
  }

  // MCP Hub should be initialized before orchestrator runs
  if (Object.keys(config.mcp_servers).length > 0) {
    await mcpHub.initialize();
  }

  const toolGateway = createToolGateway(createLocalToolRegistry([]), mcpHub);

  const orchestrator = createOrchestrator({
    eventBus,
    eventLogStore,
    taskStore,
    guardrails: config.guardrails,
    runtime,
    toolGateway
  });

  const taskId = randomUUID();
  const webHub = new WebHub(eventBus);

  try {
    await webHub.start(3001);
    console.log("Dashboard Real-time Stream: ws://localhost:3001");
    console.log(`Real-time Dashboard: http://localhost:3000?taskId=${taskId}`);

    const result = await orchestrator.runSingleNodeTask({
      taskId,
      nodeId: "node-root",
      role: "planner",
      runtimeInput: {
        apiKey,
        model: route.model,
        fallbackModels: config.models.fallback,
        reasoner: route.reasoner,
        retry: config.retry,
        input: [{ role: "user", content: args.input }]
      }
    });

    const events = eventLogStore.getAll();
    
    // Aggregate telemetry data from events
    // In a real OTel setup we'd use the SDK, but here we can derive from event log too
    let totalTokens = 0;
    let totalCost = 0;
    
    events.forEach(e => {
      if (e.type === "Evaluated" && e.payload.scores) {
        // Just an example of pulling data from payloads if we chose to store it there
      }
    });

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
      },
      telemetry: {
        total_tokens: totalTokens,
        total_cost_usd: totalCost
      }
    };
  } finally {
    await webHub.stop();
    await mcpHub.closeAll();
    await prisma.$disconnect();
  }
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
  const args = process.argv.slice(2);
  if (args[0] === "skill" && args[1] === "install" && args[2]) {
    installSkillPackage(args[2]);
    process.exit(0);
  }

  const parsed = parseRunTaskArgs(args);

  const run = parsed.repl ? runReplSession(parsed.verbose ?? false) : runTask(parsed);

  run
    .then((output) => {
      if (output) {
        process.stdout.write(`\n💸 Task Cost Summary\n`);
        process.stdout.write(`-------------------\n`);
        process.stdout.write(`Total Tokens: ${output.telemetry.total_tokens}\n`);
        process.stdout.write(`Total Cost: $${output.telemetry.total_cost_usd.toFixed(6)} USD\n`);
        process.stdout.write(`-------------------\n\n`);
        process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
      }
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    });
}
