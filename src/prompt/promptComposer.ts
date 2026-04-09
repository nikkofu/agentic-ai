import type { AgentRole, RuntimeConfig } from "../types/runtime";
import type { ExecutionContext } from "../runtime/contracts";

type PromptPayload = {
  system: string;
  role: AgentRole;
  task: string;
  context: string[];
  tools: string[];
  memory: string[];
  constraints: string[];
  output_schema: {
    type: string;
    shape: Record<string, string>;
  };
};

type StructuredPromptInput = {
  system: string;
  role: AgentRole;
  task: string;
  context: string[];
  tools: string[];
  memory: string[];
  constraints: string[];
  outputSchema: {
    type: string;
    shape: Record<string, string>;
  };
};

type ComposePromptPayloadInput = StructuredPromptInput | { context: ExecutionContext };

export function composeSystemPrompt(_config: RuntimeConfig, role: AgentRole): string {
  return `You are an AI agent acting as a ${role}.`;
}

export function composePromptPayload(input: ComposePromptPayloadInput): PromptPayload {
  if (isExecutionContextInput(input)) {
    return composePromptPayloadFromExecutionContext(input.context);
  }

  return {
    system: input.system,
    role: input.role,
    task: input.task,
    context: input.context,
    tools: input.tools,
    memory: input.memory,
    constraints: input.constraints,
    output_schema: input.outputSchema
  };
}

function composePromptPayloadFromExecutionContext(context: ExecutionContext): PromptPayload {
  const tools = context.policy?.recommendedTools ?? [];
  const constraints = [
    ...(context.policy?.verificationPolicy ? [`verification:${context.policy.verificationPolicy}`] : []),
    ...(context.policy?.requiredCapabilities ?? []).map((capability) => `capability:${capability}`)
  ];

  const promptContext = [
    `node:${context.node.input}`,
    ...context.dependencyOutputs.map((entry) => `dependency:${entry}`)
  ];

  const memory = [
    ...context.memoryRefs.map((entry) => `memref:${entry}`),
    ...context.workingMemory.map((entry) => `working:${entry}`),
    ...context.retrievalContext.map((entry) => `retrieved:${entry.sourceId}:${entry.content}`)
  ];

  return {
    system: [
      `You are an autonomous ${context.node.role} agent.`,
      "Use tools when claims require external evidence.",
      "Research or factual tasks must include verification URLs or evidence strings.",
      "Do not claim completion with an empty final_result."
    ].join("\n"),
    role: context.node.role,
    task: context.task,
    context: promptContext,
    tools,
    memory,
    constraints,
    output_schema: {
      type: "json",
      shape: {
        final_result: "string",
        verification: "string[]",
        artifacts: "string[]",
        risks: "string[]",
        next_actions: "string[]"
      }
    }
  };
}

function isExecutionContextInput(input: ComposePromptPayloadInput): input is { context: ExecutionContext } {
  return "context" in input && isExecutionContext(input.context);
}

function isExecutionContext(value: StructuredPromptInput["context"] | ExecutionContext): value is ExecutionContext {
  return typeof value === "object" && value !== null && "node" in value && "task" in value;
}
