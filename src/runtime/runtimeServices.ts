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
import { createBrowserTools } from "../tools/browserTools";
import { createResearchTools } from "../tools/researchTools";
import { createTaskExecutor } from "./executor";
import { createTaskLifecycle } from "./taskLifecycle";
import { createMemoryEngine } from "./memoryEngine";
import { createDreamRuntime } from "./dreamRuntime";
import { createDreamInspector, createMemoryInspector } from "./memoryInspectors";
import { createDreamScheduler } from "./dreamScheduler";
import { createConversationService } from "./conversationService";
import { createInMemoryConversationStore } from "./conversationStore";
import type { OpenRouterGenerateRequest, OpenRouterGenerateResponse } from "../model/openrouterClient";

let sharedConversationStore: ReturnType<typeof createInMemoryConversationStore> | null = null;

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
  const memoryStore = createMemoryEngine({
    repoRoot: process.cwd(),
    userHome: process.env.HOME ?? process.cwd()
  });
  const dreamRuntime = createDreamRuntime({
    repoRoot: process.cwd(),
    userHome: process.env.HOME ?? process.cwd()
  });
  const dreamScheduler = createDreamScheduler({
    dreamRuntime,
    thresholdMinutes: config.dream?.idle_threshold_minutes ?? 20
  });
  const conversationStore = process.env.NODE_ENV === "test"
    ? createInMemoryConversationStore()
    : (sharedConversationStore ??= createInMemoryConversationStore());

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
    ...createResearchTools(),
    ...createBrowserTools()
  ]);
  const availableLocalTools = [
    "echo",
    ...createResearchTools().map((tool) => tool.name),
    ...createBrowserTools().map((tool) => tool.name)
  ];
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
    taskStore,
    memoryInspector: createMemoryInspector({ memoryStore }),
    dreamInspector: createDreamInspector({
      repoRoot: process.cwd(),
      userHome: process.env.HOME ?? process.cwd()
    })
  });
  await conversationStore.saveAssistantProfile({
    assistantId: "assistant-main",
    displayName: "Aether",
    personaProfile: "persistent assistant",
    memoryPolicy: "default",
    channelPolicies: {
      whatsapp: "continuity-first"
    }
  });
  const conversationService = createConversationService({
    conversationStore,
    taskLifecycle,
    eventBus
  });

  return {
    config,
    eventBus,
    eventLogStore,
    taskStore,
    mcpHub,
    memoryStore,
    dreamRuntime,
    dreamScheduler,
    conversationStore,
    conversationService,
    orchestrator,
    executor,
    taskLifecycle,
    async close() {
      await mcpHub.closeAll();
      await prisma?.$disconnect();
    }
  };
}
