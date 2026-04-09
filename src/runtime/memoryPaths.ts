import path from "node:path";

export function resolveMemoryRoot(repoRoot: string, userHome: string) {
  return {
    projectRoot: path.join(repoRoot, "memory", "project"),
    taskRoot: path.join(repoRoot, "memory", "task"),
    dreamRoot: path.join(repoRoot, "memory", "dream"),
    indexRoot: path.join(repoRoot, "memory", "index"),
    personalRoot: path.join(userHome, ".agentic-ai", "memory", "personal")
  };
}
