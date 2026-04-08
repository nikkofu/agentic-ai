import { Worker, Job } from "bullmq";
import IORedis from "ioredis";

export function createAgentWorker(redisUrl: string, runtime: any, queueName: string = "agent-tasks") {
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

  const worker = new Worker(
    queueName,
    async (job: Job) => {
      const { taskId, nodeId, role, runtimeInput } = job.data;
      // 这里模拟调用 runtime 并返回结果
      // 在真实场景中，Worker 应该发布事件到共享的 EventBus (如 Redis PubSub)
      return await runtime.run(runtimeInput);
    },
    { connection }
  );

  return worker;
}
