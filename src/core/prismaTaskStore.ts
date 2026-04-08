import { PrismaClient } from "@prisma/client";
import { TaskStore, TaskNodeInput, TaskGraphInput } from "./taskStore";
import { RuntimeEvent } from "./eventBus";

export function createPrismaTaskStore(prisma: PrismaClient): TaskStore {
  return {
    async createGraph(input: TaskGraphInput) {
      await prisma.taskGraph.upsert({
        where: { task_id: input.taskId },
        create: {
          task_id: input.taskId,
          root_node_id: input.rootNodeId,
          status: "running"
        },
        update: {}
      });
    },

    async updateGraphStatus(taskId: string, status: string) {
      await prisma.taskGraph.update({
        where: { task_id: taskId },
        data: { status }
      });
    },

    async upsertNode(taskId: string, node: TaskNodeInput) {
      await prisma.taskNode.upsert({
        where: {
          task_id_node_id: {
            task_id: taskId,
            node_id: node.nodeId
          }
        },
        create: {
          task_id: taskId,
          node_id: node.nodeId,
          parent_node_id: node.parentNodeId,
          role: node.role,
          state: node.state,
          depth: node.depth,
          attempt: node.attempt,
          input_summary: node.inputSummary,
          output_summary: node.outputSummary
        },
        update: {
          state: node.state,
          attempt: node.attempt,
          output_summary: node.outputSummary
        }
      });
    },

    async getNode(taskId: string, nodeId: string) {
      const node = await prisma.taskNode.findUnique({
        where: {
          task_id_node_id: { task_id: taskId, node_id: nodeId }
        }
      });
      if (!node) return null;
      return {
        nodeId: node.node_id,
        parentNodeId: node.parent_node_id ?? undefined,
        role: node.role as any,
        state: node.state as any,
        depth: node.depth,
        attempt: node.attempt,
        inputSummary: node.input_summary,
        outputSummary: node.output_summary ?? undefined,
        children: [] // Prisma schema currently doesn't store edge list, return empty
      };
    },

    async getGraph(taskId: string) {
      const graph = await prisma.taskGraph.findUnique({
        where: { task_id: taskId }
      });
      if (!graph) return null;
      
      const nodes = await prisma.taskNode.findMany({
        where: { task_id: taskId }
      });

      return {
        taskId: graph.task_id,
        rootNodeId: graph.root_node_id,
        status: graph.status as any,
        nodes: Object.fromEntries(nodes.map(n => [n.node_id, {
          nodeId: n.node_id,
          role: n.role as any,
          state: n.state as any,
          depth: n.depth,
          attempt: n.attempt,
          inputSummary: n.input_summary,
          children: []
        }]))
      } as any;
    },

    async appendEvent(event: RuntimeEvent) {
      const taskId = (event.payload?.task_id as string) || "unknown";
      await prisma.runtimeEvent.create({
        data: {
          task_id: taskId,
          node_id: (event.payload?.node_id as string | undefined) || null,
          type: event.type,
          payload: JSON.stringify(event.payload),
          ts: BigInt(event.ts ?? Date.now())
        }
      });
    },

    async getEvents(taskId: string) {
      const events = await prisma.runtimeEvent.findMany({
        where: { task_id: taskId },
        orderBy: { ts: "asc" }
      });
      return events.map(e => ({
        type: e.type,
        payload: JSON.parse(e.payload),
        ts: Number(e.ts)
      }));
    }
  };
}
