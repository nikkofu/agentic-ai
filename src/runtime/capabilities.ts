export type ToolCapability =
  | "research"
  | "verification"
  | "repository"
  | "filesystem"
  | "coding"
  | "browser"
  | "utility";

const TOOL_CAPABILITY_MAP: Record<string, ToolCapability[]> = {
  echo: ["utility"],
  web_search: ["research"],
  page_fetch: ["research", "browser"],
  github_readme: ["repository", "research"],
  github_file: ["repository"],
  verify_sources: ["verification", "research"]
};

export function getToolCapabilities(toolName: string): ToolCapability[] {
  return TOOL_CAPABILITY_MAP[toolName] ?? [];
}

export function allowsToolByCapabilities(args: {
  tool: string;
  requiredCapabilities?: string[];
  recommendedTools?: string[];
}) {
  if ((args.recommendedTools ?? []).length > 0) {
    return (args.recommendedTools ?? []).includes(args.tool);
  }

  const required = (args.requiredCapabilities ?? []).filter(Boolean);
  if (required.length === 0) {
    return true;
  }

  const toolCaps = getToolCapabilities(args.tool);
  return required.some((capability) => toolCaps.includes(capability as ToolCapability));
}
