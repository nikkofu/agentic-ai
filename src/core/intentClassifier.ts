import type { AgentRole } from "../types/runtime";

export type TaskIntent = {
  task_kind: "general" | "research_writing" | "code_execution" | "analysis";
  execution_mode: "single_node" | "tree";
  roles: AgentRole[];
  needs_verification: boolean;
  reason: string;
};

export async function classifyIntent(args: {
  task: string;
  runtime: {
    run: (input: Record<string, unknown>) => Promise<{
      outputText?: string;
    }>;
  };
  runtimeInput: Record<string, unknown>;
}): Promise<TaskIntent> {
  const result = await args.runtime.run({
    ...args.runtimeInput,
    input: [
      {
        role: "system",
        content: [
          "You are an intent classifier for an autonomous agent runtime.",
          "Return JSON only.",
          'Schema: {"task_kind":"general|research_writing|code_execution|analysis","execution_mode":"single_node|tree","roles":["planner","researcher","coder","writer"],"needs_verification":true,"reason":"short reason"}',
          "Choose tree only when the task clearly benefits from multiple roles or staged execution.",
          "Use needs_verification=true when the task depends on factual research, external claims, or source-backed content."
        ].join("\n")
      },
      {
        role: "user",
        content: args.task
      }
    ]
  });

  const parsed = parseClassifierOutput(result.outputText);
  if (parsed) {
    return parsed;
  }

  return {
    task_kind: "general",
    execution_mode: "single_node",
    roles: ["planner"],
    needs_verification: false,
    reason: "classifier_fallback"
  };
}

function parseClassifierOutput(outputText?: string): TaskIntent | null {
  if (!outputText) {
    return null;
  }

  try {
    const parsed = JSON.parse(stripCodeFence(outputText)) as Partial<TaskIntent>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const taskKind = normalizeTaskKind(parsed.task_kind);
    const executionMode = normalizeExecutionMode(parsed.execution_mode);
    const roles = normalizeRoles(parsed.roles);

    if (!taskKind || !executionMode || roles.length === 0) {
      return null;
    }

    return {
      task_kind: taskKind,
      execution_mode: executionMode,
      roles,
      needs_verification: parsed.needs_verification === true,
      reason: typeof parsed.reason === "string" ? parsed.reason : ""
    };
  } catch {
    return null;
  }
}

function stripCodeFence(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1] : value;
}

function normalizeTaskKind(value: unknown): TaskIntent["task_kind"] | null {
  return value === "general" || value === "research_writing" || value === "code_execution" || value === "analysis"
    ? value
    : null;
}

function normalizeExecutionMode(value: unknown): TaskIntent["execution_mode"] | null {
  return value === "single_node" || value === "tree" ? value : null;
}

function normalizeRoles(value: unknown): AgentRole[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isAgentRole);
}

function isAgentRole(value: unknown): value is AgentRole {
  return value === "planner" || value === "researcher" || value === "coder" || value === "writer";
}
