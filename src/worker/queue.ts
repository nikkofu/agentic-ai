import { Queue } from "bullmq";
import IORedis from "ioredis";

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

  async close() {
    await this.queue.close();
  }
}
