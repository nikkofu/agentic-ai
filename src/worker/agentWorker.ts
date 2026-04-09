import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import type { TaskLifecycleJob } from "./queue";
import type { RuntimeEvent } from "../core/eventBus";

export function createAgentWorker(redisUrl: string, runtime: any, queueName: string = "agent-tasks") {
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const processor = createObservedNodeProcessor({ runtime });

  const worker = new Worker(
    queueName,
    processor,
    { connection }
  );

  return worker;
}

export function createObservedNodeProcessor(args: {
  runtime: {
    run: (input: unknown) => Promise<any>;
  };
  eventBus?: {
    publish: (event: RuntimeEvent) => void;
  };
}) {
  return async (job: Job) => {
    if (job.name !== "execute-node") {
      return null;
    }

    const { taskId, nodeId, ownerId, dedupeKey, runtimeInput } = job.data as {
      taskId: string;
      nodeId: string;
      ownerId?: string;
      dedupeKey?: string;
      runtimeInput: unknown;
    };

    try {
      const result = await args.runtime.run(runtimeInput);
      const finalState =
        result && typeof result.finalState === "string"
          ? result.finalState
          : "completed";
      const delivery =
        result && typeof result.delivery === "object" && result.delivery !== null
          ? result.delivery
          : undefined;
      const finalResult =
        typeof delivery?.final_result === "string"
          ? delivery.final_result
          : typeof result?.outputText === "string"
            ? result.outputText
            : undefined;
      const blockingReason =
        typeof delivery?.blocking_reason === "string"
          ? delivery.blocking_reason
          : undefined;
      args.eventBus?.publish({
        type: "AsyncNodeSettled",
        payload: {
          task_id: taskId,
          node_id: nodeId,
          owner_id: ownerId,
          dedupe_key: dedupeKey,
          final_state: finalState,
          delivery,
          final_result: finalResult,
          blocking_reason: blockingReason
        },
        ts: Date.now()
      });
      return result;
    } catch (error) {
      args.eventBus?.publish({
        type: "AsyncNodeFailed",
        payload: {
          task_id: taskId,
          node_id: nodeId,
          owner_id: ownerId,
          dedupe_key: dedupeKey,
          error: error instanceof Error ? error.message : String(error)
        },
        ts: Date.now()
      });
      throw error;
    }
  };
}

export function createTaskLifecycleWorker(
  redisUrl: string,
  lifecycle: {
    startTask: (input: { input: string; workflow?: unknown }) => Promise<unknown>;
    resumeTask: (input: { taskId: string; maxParallel?: number }) => Promise<unknown>;
  },
  options?: {
    eventBus?: {
      publish: (event: RuntimeEvent) => void;
    };
  },
  queueName: string = "agent-tasks"
) {
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const processor = createObservedTaskLifecycleProcessor({
    lifecycle,
    eventBus: options?.eventBus
  });

  return new Worker(
    queueName,
    processor,
    { connection }
  );
}

export function createTaskLifecycleProcessor(lifecycle: {
  startTask: (input: { input: string; workflow?: unknown }) => Promise<unknown>;
  resumeTask: (input: { taskId: string; maxParallel?: number }) => Promise<unknown>;
}) {
  return async (job: Job<TaskLifecycleJob>) => {
    if (job.name !== "task-lifecycle") {
      return null;
    }

    if (job.data.kind === "resume") {
      return lifecycle.resumeTask({
        taskId: job.data.taskId,
        maxParallel: job.data.maxParallel
      });
    }

    return lifecycle.startTask({
      input: job.data.input,
      workflow: job.data.workflow
    });
  };
}

export function createObservedTaskLifecycleProcessor(args: {
  lifecycle: {
    startTask: (input: { input: string; workflow?: unknown }) => Promise<any>;
    resumeTask: (input: { taskId: string; maxParallel?: number }) => Promise<any>;
  };
  eventBus?: {
    publish: (event: RuntimeEvent) => void;
  };
}) {
  const processor = createTaskLifecycleProcessor(args.lifecycle);

  return async (job: Job<TaskLifecycleJob>) => {
    try {
      const result = await processor(job);
      const taskId = typeof result?.taskId === "string"
        ? result.taskId
        : job.data.kind === "resume"
          ? job.data.taskId
          : job.data.taskId ?? "unknown";

      args.eventBus?.publish({
        type: "AsyncTaskSettled",
        payload: {
          task_id: taskId,
          job_kind: job.data.kind,
          final_state: typeof result?.finalState === "string" ? result.finalState : "completed",
          delivery: result?.delivery
        },
        ts: Date.now()
      });

      return result;
    } catch (error) {
      const taskId = job.data.kind === "resume" ? job.data.taskId : job.data.taskId ?? "unknown";
      args.eventBus?.publish({
        type: "AsyncTaskFailed",
        payload: {
          task_id: taskId,
          job_kind: job.data.kind,
          error: error instanceof Error ? error.message : String(error)
        },
        ts: Date.now()
      });
      throw error;
    }
  };
}
