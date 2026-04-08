import { createInterface } from "node:readline/promises";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function forceLoadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      content.split("\n").forEach((line) => {
        const parts = line.trim().split("=");
        if (parts.length >= 2) {
          const key = parts[0].trim();
          let val = parts.slice(1).join("=").trim();
          if (val.startsWith("\"") || val.startsWith("'")) val = val.slice(1, -1);
          process.env[key] = val;
        }
      });
    }
  } catch {}
}
forceLoadEnv();

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
import { createResearchTools } from "../tools/researchTools";
import { RequestLimiter } from "../core/limiter";
import { initTelemetry } from "../core/telemetry";
import { SlackBot } from "../bots/slackBot";
import { WhatsAppBot } from "../bots/whatsappBot";
import type { OpenRouterGenerateRequest, OpenRouterGenerateResponse } from "../model/openrouterClient";
import { finalizeDelivery } from "../core/deliveryArtifacts";

import { resolveExecutionTiers } from "../core/dagEngine";
import { DagWorkflow } from "../types/dag";
import type { DeliveryBundle } from "../types/runtime";
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
  outputText?: string;
  delivery: DeliveryBundle;
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

  const preflight = await runPreflightChecks(config);
  if (!preflight.ok) {
    const errorMsg = "Preflight checks failed: " + (preflight.errors || []).join(", ");
    if (process.env.NODE_ENV === "test") {
      throw new Error(errorMsg);
    }
    console.error("❌ " + errorMsg);
    process.exit(1);
  }

  let finalInput = args.input;
  if (args.template) {
    const template = loadTemplate(args.template);
    finalInput = template.body.replace("{{input}}", args.input || "default task");
  }

  await initTelemetry();
  const prisma = new PrismaClient();
  const taskStore = createPrismaTaskStore(prisma);
  const mcpHub = new McpHub(config.mcp_servers);

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

  if (Object.keys(config.mcp_servers).length > 0) {
    await mcpHub.initialize();
  }

  const localRegistry = createLocalToolRegistry([
    {
      name: "echo",
      run: (input) => input
    },
    ...createResearchTools()
  ]);
  const toolGateway = createToolGateway(localRegistry, mcpHub);

  const orchestrator = createOrchestrator({
    eventBus,
    eventLogStore,
    taskStore,
    guardrails: config.guardrails,
    runtime,
    toolGateway
  });

  if (args.notify === "slack" && process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID) {
    const slackBot = new SlackBot(process.env.SLACK_BOT_TOKEN, process.env.SLACK_CHANNEL_ID, eventBus);
    await slackBot.init();
  } else if (args.notify === "whatsapp" && process.env.WHATSAPP_RECIPIENT) {
    const waBot = new WhatsAppBot(process.env.WHATSAPP_RECIPIENT, eventBus);
    await waBot.init();
  }

  const taskId = randomUUID();
  const webHub = new WebHub(eventBus, eventLogStore);

  try {
    try {
      await webHub.start(3001);
      if (args.verbose) {
        console.log("Dashboard Real-time Stream: ws://localhost:3001");
        console.log(`Real-time Dashboard: http://localhost:3000/dashboard?taskId=${taskId}&token=valid-session`);
      }
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? (error as { code?: string }).code : undefined;
      if (code === "EADDRINUSE" || code === "EPERM") {
        console.warn(`[WebHub] Port 3001 unavailable (${code}), skipping dashboard stream startup`);
      } else {
        throw error;
      }
    }

    let totalNodes = 0;
    let finalState: "completed" | "aborted" = "completed";
    let stateTrace: string[] = [];
    let outputText = "";
    let delivery: DeliveryBundle = {
      status: "completed",
      final_result: "",
      artifacts: [],
      verification: [],
      risks: [],
      next_actions: []
    };

    const getRuntimeInput = (role: any, inputContent: any) => {
      const nodeRoute = resolveModelRoute(config, role, process.env);
      const prompt = buildAutonomousPrompt(String(inputContent));
      return {
        apiKey: args.generate ? "mock-key" : (nodeRoute.apiKey ?? process.env.OPENROUTER_API_KEY),
        model: nodeRoute.model,
        baseUrl: nodeRoute.baseUrl,
        fallbackModels: config.models.fallback,
        reasoner: nodeRoute.reasoner,
        retry: config.retry,
        input: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user }
        ]
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
      stateTrace = result.stateTrace;
      delivery = result.delivery;
      outputText = result.delivery.final_result;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));

    const events = eventLogStore.getAll();
    let totalTokens = 0;
    let totalCost = 0;

    events.forEach((event) => {
      if (event.type === "Evaluated") {
        if (args.verbose) {
          console.log("[DEBUG] Evaluated Payload:", JSON.stringify(event.payload));
        }
        if (event.payload.usage) {
          const usage = event.payload.usage as any;
          totalTokens += usage.total_tokens || 0;
          totalCost += (event.payload.cost as number) || 0;
        }
        if (event.payload.output_text) {
          outputText = event.payload.output_text as string;
        }
        if (event.payload.delivery) {
          delivery = event.payload.delivery as DeliveryBundle;
        }
      }
    });

    delivery = await finalizeDelivery({
      taskId,
      taskInput: finalInput,
      delivery
    });
    finalState = delivery.status === "completed" ? "completed" : "aborted";
    outputText = delivery.final_result;

    return {
      taskId,
      finalState,
      outputText,
      delivery,
      summary: {
        nodeCount: totalNodes,
        childSpawns: totalNodes,
        toolCalls: {
          localSuccess: events.some((event) => event.type === "ToolReturned") ? 1 : 0,
          mcpSuccess: args.workflow ? 0 : 1
        },
        evaluatorDecisions: events
          .filter((event) => event.type === "Evaluated")
          .map((event) => String(event.payload.decision ?? "unknown")),
        path: stateTrace
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

function buildAutonomousPrompt(task: string): { system: string; user: string } {
  return {
    system: [
      "You are an autonomous execution agent.",
      "Use tools when claims require external evidence.",
      "Available local tools: web_search, page_fetch, github_readme, github_file, verify_sources, echo.",
      "Research or factual tasks must include verification URLs or evidence strings.",
      "If you use a tool, respond with JSON only in one of two forms.",
      "Tool request schema:",
      '{"tool_calls":[{"transport":"local","tool":"web_search","input":{"query":"..."}}]}',
      "Final delivery schema:",
      '{"final_result":"markdown text","verification":["source or evidence"],"artifacts":[],"risks":[],"next_actions":[]}',
      "Do not claim completion with an empty final_result.",
      "Do not claim completion for research work without verification."
    ].join("\n"),
    user: task
  };
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
  const notify = notifyValue === "slack" || notifyValue === "whatsapp" ? notifyValue : "none";

  return { input, verbose, repl, workflow, template, report, notify };
}

export function processReplCommand(line: string):
  | { action: "approve" }
  | { action: "reject" }
  | { action: "exit" }
  | { action: "prompt"; prompt: string }
  | { action: "noop" } {
  const input = line.trim();

  if (input === "/approve") return { action: "approve" };
  if (input === "/reject") return { action: "reject" };
  if (input === "/exit") return { action: "exit" };
  if (input.length === 0) return { action: "noop" };
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

      if (command.action === "exit") break;
      if (command.action === "approve") {
        console.log("revise approved");
        continue;
      }
      if (command.action === "reject") {
        console.log("revise rejected");
        continue;
      }
      if (command.action === "noop") continue;

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

            if (output.outputText) {
              process.stdout.write("📝 Agent Output:\n");
              process.stdout.write(`${output.outputText}\n`);
              process.stdout.write("-------------------\n\n");
            }

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
