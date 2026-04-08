import { PrismaClient } from "@prisma/client";

import { createAgentRuntime } from "../agents/agentRuntime";
import { getRuntimeConfig } from "../config/loadRuntimeConfig";
import { createInMemoryEventBus } from "../core/eventBus";
import { createInMemoryEventLogStore } from "../core/eventLogStore";
import { createOrchestrator } from "../core/orchestrator";
import { RequestLimiter } from "../core/limiter";
import { createPrismaTaskStore } from "../core/prismaTaskStore";
import { createInMemoryTaskStore } from "../core/taskStore";
import { finalizeDelivery } from "../core/deliveryArtifacts";
import { resolveModelRoute } from "../model/modelRouter";
import { McpHub } from "../tools/mcpHub";
import { createToolGateway } from "../tools/toolGateway";
import { createLocalToolRegistry } from "../tools/localToolRegistry";
import { createResearchTools } from "../tools/researchTools";
import { createTaskExecutor } from "./executor";
import { createTaskLifecycle } from "./taskLifecycle";
import { createTaskMemoryStore } from "./memory";
import type { OpenRouterGenerateRequest, OpenRouterGenerateResponse } from "../model/openrouterClient";

export async function createRuntimeServices(args?: {
  generate?: (request: OpenRouterGenerateRequest) => Promise<OpenRouterGenerateResponse>;
}) {
  const config = getRuntimeConfig();
  const eventBus = createInMemoryEventBus();
  const eventLogStore = createInMemoryEventLogStore();
  const useInMemoryPersistence = process.env.NODE_ENV === "test";
  const prisma = useInMemoryPersistence ? null : new PrismaClient();
  const taskStore = useInMemoryPersistence
    ? createInMemoryTaskStore()
    : createPrismaTaskStore(prisma!);
  const mcpHub = new McpHub(config.mcp_servers);
  const memoryStore = createTaskMemoryStore();

  let limiter: RequestLimiter | undefined;
  if (config.scheduler.rate_limit) {
    limiter = new RequestLimiter({
      capacity: config.scheduler.rate_limit.burst_capacity,
      refillRatePerSecond: config.scheduler.rate_limit.requests_per_minute / 60
    });
  }

  const runtime = createAgentRuntime({
    mode: "openrouter",
    generate: args?.generate,
    limiter
  });

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
  const availableLocalTools = ["echo", ...createResearchTools().map((tool) => tool.name)];
  const toolGateway = createToolGateway(localRegistry, mcpHub);

  const orchestrator = createOrchestrator({
    eventBus,
    eventLogStore,
    taskStore,
    guardrails: config.guardrails,
    runtime,
    toolGateway,
    memoryStore
  });

  const executor = createTaskExecutor({
    config,
    eventBus,
    eventLogStore,
    runtime,
    orchestrator,
    finalizeDelivery,
    taskStore,
    resolveModelRoute,
    availableLocalTools,
    env: process.env,
    memoryStore
  });

  const taskLifecycle = createTaskLifecycle({
    executor,
    taskStore
  });

  return {
    config,
    eventBus,
    eventLogStore,
    taskStore,
    mcpHub,
    memoryStore,
    orchestrator,
    executor,
    taskLifecycle,
    async close() {
      await mcpHub.closeAll();
      await prisma?.$disconnect();
    }
  };
}
