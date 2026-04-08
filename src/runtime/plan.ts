import type { DagNode, DagWorkflow } from "../types/dag";
import type { PlannedWorkflow, TaskIntent } from "./contracts";
import { normalizeStringList } from "./policy";

export type PlannerWorkflowSpec = {
  summary?: string;
  recommended_tools?: string[];
  required_capabilities?: string[];
  verification_policy?: string;
  spawn_children?: Array<{
    id?: string;
    role?: string;
    input?: string;
    depends_on?: string[];
  }>;
};

export function buildWorkflowFromIntent(intent: TaskIntent | null, task: string): DagWorkflow | null {
  if (!intent || intent.execution_mode !== "tree") {
    return null;
  }

  const nodes: DagNode[] = [
    {
      id: "node-root",
      role: "planner",
      input: `Plan the execution for this task and define success criteria.\n\n${task}`,
      depends_on: []
    }
  ];

  if (intent.roles.includes("researcher")) {
    nodes.push({
      id: "node-research",
      role: "researcher",
      input: `Research the topic with tools first. Gather factual notes and sources.\n\n${task}`,
      depends_on: ["node-root"]
    });
  }

  if (intent.needs_verification && intent.roles.includes("researcher")) {
    nodes.push({
      id: "node-verify",
      role: "researcher",
      input: `Verify the key claims from the research step. Prefer verify_sources and direct evidence.\n\n${task}`,
      depends_on: ["node-research"]
    });
  }

  if (intent.roles.includes("writer")) {
    nodes.push({
      id: "node-write",
      role: "writer",
      input: `Write the final user-facing deliverable using evidence-backed material from previous steps.\n\n${task}`,
      depends_on: nodes.some((node) => node.id === "node-verify")
        ? ["node-research", "node-verify"]
        : nodes.some((node) => node.id === "node-research")
          ? ["node-research"]
          : ["node-root"]
    });
  }

  return { nodes };
}

export async function planWorkflowFromPlanner(args: {
  task: string;
  intent: TaskIntent;
  availableTools: string[];
  runtime: {
    run: (input: Record<string, unknown>) => Promise<{ outputText?: string }>;
  };
  runtimeInput: Record<string, unknown>;
}): Promise<PlannedWorkflow | null> {
  const result = await args.runtime.run({
    ...args.runtimeInput,
    input: [
      {
        role: "system",
        content: [
          "You are a planning agent for an autonomous runtime.",
          "Return JSON only.",
          'Schema: {"summary":"short planning summary","recommended_tools":["web_search"],"required_capabilities":["research","verification"],"verification_policy":"cite source urls","spawn_children":[{"id":"node-research","role":"researcher","input":"specific objective","depends_on":["node-root"]}]}',
          "Generate child nodes only. The runtime will create the root planner node automatically.",
          "Prefer concise, capability-oriented child nodes. Use depends_on to express execution order.",
          `Intent: ${args.intent.task_kind}, needs_verification=${String(args.intent.needs_verification)}, roles=${args.intent.roles.join(",")}`,
          `Available local tools: ${args.availableTools.join(", ")}`
        ].join("\n")
      },
      {
        role: "user",
        content: args.task
      }
    ]
  });

  const parsed = parsePlannerWorkflowSpec(result.outputText);
  if (!parsed?.spawn_children?.length) {
    return null;
  }

  const nodes: DagNode[] = [
    {
      id: "node-root",
      role: "planner",
      input: parsed.summary?.trim()
        ? `Use this planning summary to coordinate the task.\n\n${parsed.summary}\n\nOriginal task:\n${args.task}`
        : `Plan the execution for this task and define success criteria.\n\n${args.task}`,
      depends_on: []
    }
  ];

  for (const child of parsed.spawn_children) {
    const role = normalizePlannerRole(child.role);
    const id = typeof child.id === "string" && child.id.trim() ? child.id.trim() : null;
    const input = typeof child.input === "string" && child.input.trim() ? child.input.trim() : null;
    if (!role || !id || !input) {
      continue;
    }
    const dependsOn = Array.isArray(child.depends_on) && child.depends_on.length > 0
      ? child.depends_on.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : ["node-root"];
    nodes.push({
      id,
      role,
      input,
      depends_on: dependsOn
    });
  }

  if (nodes.length <= 1) {
    return null;
  }

  return {
    nodes,
    recommendedTools: normalizeStringList(parsed.recommended_tools),
    requiredCapabilities: normalizeStringList(parsed.required_capabilities),
    verificationPolicy: typeof parsed.verification_policy === "string" ? parsed.verification_policy : ""
  };
}

function parsePlannerWorkflowSpec(outputText?: string): PlannerWorkflowSpec | null {
  if (!outputText) {
    return null;
  }

  try {
    const parsed = JSON.parse(stripCodeFence(outputText)) as PlannerWorkflowSpec;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function stripCodeFence(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1] : value;
}

function normalizePlannerRole(role: unknown): DagNode["role"] | null {
  return role === "planner" || role === "researcher" || role === "coder" || role === "writer"
    ? role
    : null;
}
