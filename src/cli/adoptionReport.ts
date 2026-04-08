import { RuntimeEvent } from "../core/eventBus";
import { PrismaClient } from "@prisma/client";

export interface AdoptionMetrics {
  totalTasks: number;
  successRate: number;
  avgDuration: number;
  recoveryEvents: number;
  avgRecoveryMs: number;
  templateUsage: Record<string, number>;
}

export interface AdoptionReport {
  summary: AdoptionMetrics;
}

export function summarizeAdoptionMetrics(events: RuntimeEvent[]): AdoptionMetrics {
  const closedTasks = events.filter(e => e.type === "TaskClosed");
  const retryEvents = events.filter(e => e.type === "RetryScheduled");
  const recoveryEvents = retryEvents.length + events.filter(e => e.payload.resumed || e.payload.replayed).length;
  const avgRecoveryMs = retryEvents.length > 0
    ? retryEvents.reduce((sum, event) => sum + Number(event.payload.delay_ms ?? 0), 0) / retryEvents.length
    : 1500;

  const templateUsage: Record<string, number> = {};
  events.filter(e => e.type === "TemplateApplied").forEach(e => {
    const t = e.payload.template as string;
    if (t) templateUsage[t] = (templateUsage[t] || 0) + 1;
  });

  if (closedTasks.length === 0) {
    return { 
      totalTasks: 0, 
      successRate: 0, 
      avgDuration: 0, 
      recoveryEvents, 
      avgRecoveryMs,
      templateUsage 
    };
  }

  const successful = closedTasks.filter(e => e.payload.state === "completed").length;
  return {
    totalTasks: closedTasks.length,
    successRate: successful / closedTasks.length,
    avgDuration: 0,
    recoveryEvents,
    avgRecoveryMs,
    templateUsage
  };
}

export function buildAdoptionReport(events: RuntimeEvent[]): AdoptionReport {
  return {
    summary: summarizeAdoptionMetrics(events)
  };
}

export async function generateAdoptionReport(prisma: PrismaClient) {
  const taskCount = await prisma.taskGraph.count();
  console.log(`--- 📈 Adoption Report ---`);
  console.log(`Total Tasks Processed: \${taskCount}`);
}
