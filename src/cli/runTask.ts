import { createInterface } from "node:readline/promises";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

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

import { getRuntimeConfig } from "../config/loadRuntimeConfig";
import { WebHub } from "../core/webHub";
import { initTelemetry } from "../core/telemetry";
import { SlackBot } from "../bots/slackBot";
import { createWhatsAppAdapter } from "../bots/whatsappAdapter";
import type { OpenRouterGenerateRequest, OpenRouterGenerateResponse } from "../model/openrouterClient";
import type { DagWorkflow } from "../types/dag";
import type { DeliveryBundle } from "../types/runtime";
import type { FamilyDeliveryBundle } from "../runtime/contracts";
import { createRuntimeServices } from "../runtime/runtimeServices";
import YAML from "yaml";

type RunTaskInput = {
  input: string;
  repl?: boolean;
  verbose?: boolean;
  workflow?: string;
  resumeTaskId?: string;
  template?: string;
  report?: boolean;
  notify?: "slack" | "whatsapp" | "none";
  generate?: (request: OpenRouterGenerateRequest) => Promise<OpenRouterGenerateResponse>;
};

type RunTaskResult = {
  taskId: string;
  finalState: "completed" | "aborted";
  outputText?: string;
  delivery: DeliveryBundle | FamilyDeliveryBundle;
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
  const services = await createRuntimeServices({
    generate: args.generate
  });

  if (args.notify === "slack" && process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID) {
    const slackBot = new SlackBot(process.env.SLACK_BOT_TOKEN, process.env.SLACK_CHANNEL_ID, services.eventBus);
    await slackBot.init();
  } else if (args.notify === "whatsapp" && process.env.WHATSAPP_RECIPIENT) {
    const waAdapter = createWhatsAppAdapter({
      recipientJid: process.env.WHATSAPP_RECIPIENT,
      eventBus: services.eventBus,
      conversationService: services.conversationService
    });
    await waAdapter.init();
  }
  const taskId = randomUUID();
  if (args.verbose) {
    services.eventBus.subscribe("*", (event) => {
      const key = event.payload.task_id ?? event.payload.node_id ?? "-";
      console.log(`[${new Date(event.ts).toISOString()}] ${event.type} key=${String(key)}`);
    });
  }
  const webHub = new WebHub(services.eventBus, services.eventLogStore);

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

    const workflow = args.workflow
      ? (YAML.parse(fs.readFileSync(args.workflow, "utf8")) as DagWorkflow)
      : undefined;

    return args.resumeTaskId
      ? await services.taskLifecycle.resumeTask({
          taskId: args.resumeTaskId
        })
      : await services.taskLifecycle.startTask({
          input: finalInput,
          workflow
        });
  } finally {
    await webHub.stop();
    await services.close();
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

  const resumeArgIndex = argv.findIndex((arg) => arg === "--resume" || arg === "-r");
  const resumeTaskId = resumeArgIndex >= 0 ? argv[resumeArgIndex + 1] ?? undefined : undefined;

  const templateArgIndex = argv.findIndex((arg) => arg === "--template" || arg === "-t");
  const template = templateArgIndex >= 0 ? argv[templateArgIndex + 1] ?? undefined : undefined;

  const notifyArgIndex = argv.findIndex((arg) => arg === "--notify");
  const notifyValue = notifyArgIndex >= 0 ? argv[notifyArgIndex + 1] : undefined;
  const notify = notifyValue === "slack" || notifyValue === "whatsapp" ? notifyValue : "none";

  return { input, verbose, repl, workflow, resumeTaskId, template, report, notify };
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
