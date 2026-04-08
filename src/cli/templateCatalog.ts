export type TemplateName = "research" | "execution" | "multi-agent";

export type BuiltInTemplate = {
  name: TemplateName;
  body: string;
};

const templates: Record<TemplateName, string> = {
  research: [
    "Goal:",
    "- Analyze the problem space and identify key constraints.",
    "Input:",
    "- Topic: {{input}}",
    "Expected Output:",
    "- Structured findings, risks, and recommended next actions."
  ].join("\n"),
  execution: [
    "Goal:",
    "- Execute a concrete implementation task with clear acceptance criteria.",
    "Input:",
    "- Task: {{input}}",
    "Expected Output:",
    "- Implemented changes, verification evidence, and remaining risks."
  ].join("\n"),
  "multi-agent": [
    "Goal:",
    "- Coordinate parallel subtasks and merge outputs safely.",
    "Input:",
    "- Main objective: {{input}}",
    "Expected Output:",
    "- Combined result with per-subtask status and integration notes."
  ].join("\n")
};

export function loadTemplate(name: string): BuiltInTemplate {
  const key = name as TemplateName;
  const body = templates[key];
  if (!body) {
    throw new Error(`Unknown template: ${name}`);
  }
  return { name: key, body };
}
