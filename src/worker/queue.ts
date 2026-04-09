import { Queue } from "bullmq";
import IORedis from "ioredis";
import { randomUUID } from "node:crypto";

export type TaskLifecycleJob =
  | {
      kind: "start";
      taskId?: string;
      input: string;
      workflow?: unknown;
      ownerId?: string;
      dedupeKey?: string;
    }
  | {
      kind: "resume";
      taskId: string;
      maxParallel?: number;
      ownerId?: string;
      dedupeKey?: string;
    };

export class TaskQueue {
  private queue: Queue;

  constructor(redisUrl: string, queueName: string = "agent-tasks") {
    const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue(queueName, { connection });
  }

  async addJob(taskId: string, nodeId: string, payload: any) {
    const dedupeKey = `${taskId}-${nodeId}`;
    return this.queue.add("execute-node", {
      taskId,
      nodeId,
      ownerId: randomUUID(),
      dedupeKey,
      enqueuedAt: new Date().toISOString(),
      ...payload
    }, {
      jobId: `${taskId}-${nodeId}`
    });
  }

  async addLifecycleJob(job: TaskLifecycleJob) {
    const ownerId = job.ownerId ?? randomUUID();
    const dedupeKey = job.dedupeKey ?? (job.kind === "resume"
      ? `resume-${job.taskId}`
      : `start-${job.taskId ?? "pending"}`);
    const jobId = job.kind === "resume"
      ? dedupeKey
      : dedupeKey;

    return this.queue.add("task-lifecycle", {
      ...job,
      ownerId,
      dedupeKey
    }, { jobId });
  }

  async close() {
    await this.queue.close();
  }
}
