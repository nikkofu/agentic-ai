import type { SchedulerPolicy } from "./policy";

export function select(frontier: string[], policy: SchedulerPolicy): string | undefined {
  if (frontier.length === 0) {
    return undefined;
  }

  if (policy === "dfs") {
    return frontier[frontier.length - 1];
  }

  return frontier[0];
}
