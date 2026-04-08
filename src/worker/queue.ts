import { Queue } from "bullmq";
import IORedis from "ioredis";

export type TaskLifecycleJob =
  | {
      kind: "start";
      taskId?: string;
      input: string;
      workflow?: unknown;
    }
  | {
      kind: "resume";
      taskId: string;
      maxParallel?: number;
    };

export class TaskQueue {
  private queue: Queue;

  constructor(redisUrl: string, queueName: string = "agent-tasks") {
    const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue(queueName, { connection });
  }

  async addJob(taskId: string, nodeId: string, payload: any) {
    return this.queue.add("execute-node", { taskId, nodeId, ...payload }, {
      jobId: `${taskId}-${nodeId}`
    });
  }

  async addLifecycleJob(job: TaskLifecycleJob) {
    const jobId = job.kind === "resume"
      ? `resume-${job.taskId}`
      : `start-${job.taskId ?? "pending"}-${Date.now()}`;

    return this.queue.add("task-lifecycle", job, { jobId });
  }

  async close() {
    await this.queue.close();
  }
}
