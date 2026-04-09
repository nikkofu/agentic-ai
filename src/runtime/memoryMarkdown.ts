import type { MemoryLayer, MemoryState } from "./memoryContracts";

type MemoryMarkdownFrontmatter = {
  id: string;
  layer: MemoryLayer;
  state: MemoryState;
  kind: string;
  confidence: string;
  tags?: string[];
  taskId?: string;
  source_refs?: string[];
};

type MemoryMarkdownDocument = {
  frontmatter: MemoryMarkdownFrontmatter;
  body: string;
};

export function serializeMemoryMarkdown(document: MemoryMarkdownDocument): string {
  const lines = [
    "---",
    ...Object.entries(document.frontmatter).flatMap(([key, value]) => {
      if (Array.isArray(value)) {
        return [`${key}:`, ...value.map((entry) => `  - ${entry}`)];
      }
      return [`${key}: ${value}`];
    }),
    "---",
    document.body
  ];

  return `${lines.join("\n")}\n`;
}

export function parseMemoryMarkdown(markdown: string): MemoryMarkdownDocument {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new Error("Invalid memory markdown document");
  }

  const [, rawFrontmatter, body] = match;
  const frontmatter = parseFrontmatter(rawFrontmatter);
  return {
    frontmatter,
    body
  };
}

function parseFrontmatter(frontmatter: string): MemoryMarkdownFrontmatter {
  const result: Record<string, unknown> = {};
  let currentArrayKey: string | null = null;

  for (const line of frontmatter.split("\n")) {
    if (!line.trim()) {
      continue;
    }

    const arrayMatch = line.match(/^\s*-\s+(.*)$/);
    if (arrayMatch && currentArrayKey) {
      const current = (result[currentArrayKey] as string[] | undefined) ?? [];
      current.push(arrayMatch[1]);
      result[currentArrayKey] = current;
      continue;
    }

    const fieldMatch = line.match(/^([A-Za-z0-9_]+):(?:\s+(.*))?$/);
    if (!fieldMatch) {
      continue;
    }

    const [, key, value] = fieldMatch;
    if (typeof value === "string") {
      result[key] = value;
      currentArrayKey = null;
    } else {
      result[key] = [];
      currentArrayKey = key;
    }
  }

  return {
    id: String(result.id ?? ""),
    layer: String(result.layer ?? "task") as MemoryLayer,
    state: String(result.state ?? "raw") as MemoryState,
    kind: String(result.kind ?? ""),
    confidence: String(result.confidence ?? ""),
    tags: Array.isArray(result.tags) ? (result.tags as string[]) : undefined,
    taskId: typeof result.taskId === "string" ? result.taskId : undefined,
    source_refs: Array.isArray(result.source_refs) ? (result.source_refs as string[]) : undefined
  };
}
