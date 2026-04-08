export type TemplateName = "research" | "execution" | "multi-agent";

export type BuiltInTemplate = {
  name: TemplateName;
  content: string;
};

const templates: Record<TemplateName, string> = {
  research: [
    "Goal:",
    "- Analyze the problem space and identify key constraints.",
    "Input:",
    "- Topic description and known context.",
    "Expected Output:",
    "- Structured findings, risks, and recommended next actions."
  ].join("\n"),
  execution: [
    "Goal:",
    "- Execute a concrete implementation task with clear acceptance criteria.",
    "Input:",
    "- Task description, scope boundaries, and constraints.",
    "Expected Output:",
    "- Implemented changes, verification evidence, and remaining risks."
  ].join("\n"),
  "multi-agent": [
    "Goal:",
    "- Coordinate parallel subtasks and merge outputs safely.",
    "Input:",
    "- Main objective and decomposed independent subtasks.",
    "Expected Output:",
    "- Combined result with per-subtask status and integration notes."
  ].join("\n")
};

export function getTemplateByName(name: string): BuiltInTemplate {
  const key = name as TemplateName;
  const content = templates[key];
  if (!content) {
    throw new Error(`Unknown template: ${name}`);
  }
  return { name: key, content };
}
