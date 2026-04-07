export type PromptComposerInput = {
  system: string;
  role: "planner" | "researcher" | "coder" | "writer";
  task: string;
  context: string[];
  tools: string[];
  memory: string[];
  constraints: string[];
  outputSchema: unknown;
};

export type PromptPayload = {
  system: string;
  role: PromptComposerInput["role"];
  task: string;
  context: string[];
  tools: string[];
  memory: string[];
  constraints: string[];
  output_schema: unknown;
};

export function composePromptPayload(input: PromptComposerInput): PromptPayload {
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
