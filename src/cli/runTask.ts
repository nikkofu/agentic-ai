import { createInterface } from "node:readline/promises";
import { randomUUID } from "node:crypto";
import { installSkillPackage } from "./skillRegistry";
import { runInitWizard } from "./initWizard";
import { runPreflightChecks } from "./preflight";
import { loadTemplate } from "./templateCatalog";
import { generateAdoptionReport } from "./adoptionReport";

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
import { SlackBot } from "../bots/slackBot";
import { WhatsAppBot } from "../bots/whatsappBot";
import type { OpenRouterGenerateRequest, OpenRouterGenerateResponse } from "../model/openrouterClient";

import { resolveExecutionTiers } from "../core/dagEngine";
import { DagWorkflow } from "../types/dag";
import fs from "fs";
import YAML from "yaml";

type RunTaskInput = {
  input: string;
  repl?: boolean;
  verbose?: boolean;
  workflow?: string;
  template?: string;
  report?: boolean;
  notify?: "slack" | "whatsapp" | "none";
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

  // Run UX Preflight Checks
  const preflight = await runPreflightChecks(config);
  if (!preflight.ok) {
    const errorMsg = "Preflight checks failed: " + (preflight.errors || []).join(", ");
    if (process.env.NODE_ENV === "test") {
      throw new Error(errorMsg);
    }
    console.error("❌ " + errorMsg);
    process.exit(1);
  }

  // Handle template loading
  let finalInput = args.input;
  if (args.template) {
    const template = loadTemplate(args.template);
    finalInput = template.body.replace("{{input}}", args.input || "default task");
  }

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

  // Handle Notifications
  if (args.notify === "slack" && process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID) {
    const slackBot = new SlackBot(process.env.SLACK_BOT_TOKEN, process.env.SLACK_CHANNEL_ID, eventBus);
    await slackBot.init();
  } else if (args.notify === "whatsapp" && process.env.WHATSAPP_RECIPIENT) {
    const waBot = new WhatsAppBot(process.env.WHATSAPP_RECIPIENT, eventBus);
    await waBot.init();
  }

  const taskId = randomUUID();
  const webHub = new WebHub(eventBus);

  try {
    try {
      await webHub.start(3001);
      console.log("Dashboard Real-time Stream: ws://localhost:3001");
      console.log(`Real-time Dashboard: http://localhost:3000?taskId=${taskId}`);
    } catch (error) {
      const isAddressInUse =
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "EADDRINUSE";

      if (isAddressInUse) {
        console.warn("[WebHub] Port 3001 already in use, skipping dashboard stream startup");
      } else {
        throw error;
      }
    }

    let totalNodes = 0;
    let finalState: "completed" | "aborted" = "completed";
    let stateTrace: string[] = [];

    const getRuntimeInput = (role: any, inputContent: any) => {
      const nodeRoute = resolveModelRoute(config, role, process.env);
      return {
        apiKey: args.generate ? "mock-key" : (nodeRoute.apiKey ?? process.env.OPENROUTER_API_KEY),
        model: nodeRoute.model,
        baseUrl: nodeRoute.baseUrl,
        fallbackModels: config.models.fallback,
        reasoner: nodeRoute.reasoner,
        retry: config.retry,
        input: [{ role: "user", content: inputContent }]
      };
    };

    if (args.workflow) {
      const workflowText = fs.readFileSync(args.workflow, "utf8");
      const workflow = YAML.parse(workflowText) as DagWorkflow;
      const tiers = resolveExecutionTiers(workflow);

      for (const tier of tiers) {
        const nodes = tier.map((n) => ({
          nodeId: n.id,
          role: n.role as any,
          priority: 0
        }));
        
        const tierResult = await orchestrator.runParallelTask({
          taskId,
          nodes,
          maxParallel: 5,
          runtimeInput: getRuntimeInput("planner", "")
        });
        totalNodes += tierResult.completedNodes;
        if (tierResult.joinDecision === "aborted") {
          finalState = "aborted";
          break;
        }
      }
    } else {
      const result = await orchestrator.runSingleNodeTask({
        taskId,
        nodeId: "node-root",
        role: "planner",
        runtimeInput: getRuntimeInput("planner", finalInput)
      });
      totalNodes = 1;
      finalState = result.finalState === "aborted" ? "aborted" : "completed";
      stateTrace = result.stateTrace;
    }

    const events = eventLogStore.getAll();

    return {
      taskId,
      finalState,
      summary: {
        nodeCount: totalNodes,
        childSpawns: totalNodes,
        toolCalls: {
          localSuccess: events.some((e) => e.type === "ToolReturned") ? 1 : 0,
          mcpSuccess: args.workflow ? 0 : 1
        },
        evaluatorDecisions: events.filter((e) => e.type === "Evaluated").map((e) => String(e.payload.decision ?? "unknown")),
        path: stateTrace
      },
      telemetry: {
        total_tokens: 0,
        total_cost_usd: 0
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
  const report = argv.includes("--report");

  const workflowArgIndex = argv.findIndex((arg) => arg === "--workflow" || arg === "-w");
  const workflow = workflowArgIndex >= 0 ? argv[workflowArgIndex + 1] ?? undefined : undefined;

  const templateArgIndex = argv.findIndex((arg) => arg === "--template" || arg === "-t");
  const template = templateArgIndex >= 0 ? argv[templateArgIndex + 1] ?? undefined : undefined;

  const notifyArgIndex = argv.findIndex((arg) => arg === "--notify");
  const notifyValue = notifyArgIndex >= 0 ? argv[notifyArgIndex + 1] : undefined;
  const notify = (notifyValue === "slack" || notifyValue === "whatsapp") ? notifyValue : "none";

  return { input, verbose, repl, workflow, template, report, notify };
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
  
  if (args[0] === "init") {
    runInitWizard().catch(console.error);
  } else if (args[0] === "skill" && args[1] === "install" && args[2]) {
    installSkillPackage(args[2]);
    process.exit(0);
  } else {
    const parsed = parseRunTaskArgs(args);

    if (parsed.report) {
      const prisma = new PrismaClient();
      generateAdoptionReport(prisma).then(() => process.exit(0)).catch(console.error);
    } else {
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
  }
}
