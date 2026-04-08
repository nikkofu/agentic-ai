import type { RuntimeEvent } from "./eventBus";

type ActorStats = {
  total: number;
  completed: number;
  failed: number;
};

export type TeamViewProjection = {
  byActor: Record<string, ActorStats>;
};

function getActor(event: RuntimeEvent): string {
  const actor = (event.payload?.actor as string | undefined)?.trim();
  if (actor) return actor;
  const role = (event.payload?.role as string | undefined)?.trim();
  return role || "unknown";
}

function ensure(stats: Record<string, ActorStats>, actor: string): ActorStats {
  if (!stats[actor]) {
    stats[actor] = { total: 0, completed: 0, failed: 0 };
  }
  return stats[actor];
}

export function projectTeamView(events: RuntimeEvent[]): TeamViewProjection {
  const byActor: Record<string, ActorStats> = {};

  for (const event of events) {
    const actor = getActor(event);
    const stat = ensure(byActor, actor);

    if (event.type === "AgentStarted") {
      stat.total += 1;
    }

    if (event.type === "NodeCompleted") {
      stat.completed += 1;
    }

    if (event.type === "NodeFailed" || event.type === "NodeAborted") {
      stat.failed += 1;
    }
  }

  return { byActor };
}
