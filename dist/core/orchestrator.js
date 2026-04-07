import { createAgentRuntime } from "../agents/agentRuntime";
import { checkSpawnGuardrails } from "../guardrails/guardrails";
export function createOrchestrator(deps) {
    deps.eventBus.subscribe((event) => deps.eventLogStore.append(event));
    const runtime = deps.runtime ?? createAgentRuntime();
    const runNode = async (input) => {
        const stateTrace = ["pending"];
        publish(deps.eventBus, "NodeScheduled", { task_id: input.taskId, node_id: input.nodeId });
        stateTrace.push("running");
        publish(deps.eventBus, "AgentStarted", { task_id: input.taskId, node_id: input.nodeId, role: input.role });
        publish(deps.eventBus, "PromptComposed", { task_id: input.taskId, node_id: input.nodeId });
        publish(deps.eventBus, "ModelCalled", { task_id: input.taskId, node_id: input.nodeId });
        stateTrace.push("waiting_tool");
        publish(deps.eventBus, "ToolInvoked", { task_id: input.taskId, node_id: input.nodeId, tool: "echo" });
        await runtime.run(input.runtimeInput);
        publish(deps.eventBus, "ToolReturned", { task_id: input.taskId, node_id: input.nodeId, ok: true });
        stateTrace.push("evaluating");
        publish(deps.eventBus, "Evaluated", { task_id: input.taskId, node_id: input.nodeId, decision: "stop" });
        stateTrace.push("completed");
        publish(deps.eventBus, "NodeCompleted", { task_id: input.taskId, node_id: input.nodeId });
        return {
            finalState: "completed",
            stateTrace
        };
    };
    return {
        runSingleNodeTask: async (input) => {
            publish(deps.eventBus, "TaskSubmitted", { task_id: input.taskId });
            const guardrail = checkSpawnGuardrails({
                currentDepth: 0,
                childrenCount: 0,
                totalSteps: 0,
                spentBudget: 0
            }, deps.guardrails);
            if (!guardrail.allowed) {
                publish(deps.eventBus, "GuardrailTripped", { task_id: input.taskId, node_id: input.nodeId, reason: guardrail.reason });
                publish(deps.eventBus, "TaskClosed", { task_id: input.taskId, state: "aborted" });
                return { finalState: "aborted", stateTrace: ["pending", "aborted"] };
            }
            const result = await runNode(input);
            publish(deps.eventBus, "TaskClosed", { task_id: input.taskId, state: "completed" });
            return result;
        },
        runParallelTask: async (input) => {
            const results = [];
            const queue = [...input.nodes];
            const activePromises = new Set();
            const runNext = async () => {
                if (queue.length === 0)
                    return;
                const node = queue.shift();
                const res = await runNode({
                    taskId: input.taskId,
                    nodeId: node.nodeId,
                    role: node.role,
                    runtimeInput: {}
                });
                results.push({ nodeId: node.nodeId, state: res.finalState });
            };
            const workers = Array.from({ length: Math.min(input.maxParallel, input.nodes.length) }, async () => {
                while (queue.length > 0) {
                    await runNext();
                }
            });
            await Promise.all(workers);
            publish(deps.eventBus, "JoinEvaluated", {
                task_id: input.taskId,
                node_count: results.length,
                decision: "stop"
            });
            return {
                completedNodes: results.length,
                joinDecision: "stop"
            };
        }
    };
}
function publish(eventBus, type, payload) {
    eventBus.publish({ type, payload, ts: Date.now() });
}
