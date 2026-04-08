# Phase 9: Enterprise Ready & Distributed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 满足大规模团队的横向扩展和安全合规需求，引入 Redis 任务队列、分布式 Worker 架构以及凭证保险箱。

**Architecture:** 将 `Orchestrator` 作为调度节点，具体的 Agent 执行下发至 `BullMQ` 队列；实现 `SecretProvider` 接口对接生产级 KMS 服务。

**Tech Stack:** TypeScript, Redis (BullMQ).

---

### Task 1: 分布式 Worker 架构 (Redis Queue)

**Files:**
- Create: `src/worker/queue.ts`
- Create: `src/worker/agentWorker.ts`
- Modify: `src/core/orchestrator.ts`
- Test: `tests/integration/distributed-queue.test.ts`

- [x] **Step 1: 安装 BullMQ 依赖**
```bash
npm install bullmq ioredis
```

- [x] **Step 2: 定义队列与 Worker**
在 `src/worker/queue.ts` 中创建 `TaskQueue`。
在 `src/worker/agentWorker.ts` 中实例化 `Worker`，监听队列。当接收到 Job 时，调用本地的 `AgentRuntime` 进行真正的 LLM 通信。

- [x] **Step 3: Orchestrator 派发机制**
修改 `orchestrator.ts` 的 `runParallelTask`，如果配置了 Redis URL，则将节点执行指令派发到 Queue，而不是直接调用 `runNode`。监听 Job 完成事件来更新 `TaskStore`。

- [x] **Step 4: 测试并提交**
编写基于内存 Redis Mock 的验证测试。
```bash
npm test
git add package.json src/worker/ src/core/orchestrator.ts
git commit -m "feat: introduce Redis-backed distributed worker architecture"
```

---

### Task 2: 凭证保险箱 (SecretProvider)

**Files:**
- Create: `src/core/secretProvider.ts`
- Modify: `src/agents/agentRuntime.ts`
- Test: `tests/unit/secretProvider.test.ts`

- [x] **Step 1: 定义 SecretProvider 接口**
```typescript
export interface SecretProvider {
  getSecret(key: string): Promise<string | null>;
}
```
实现 `EnvSecretProvider` (读取 process.env) 作为默认实现。

- [x] **Step 2: 重构凭证获取路径**
移除项目中所有直接读取 `process.env.OPENROUTER_API_KEY` 的地方。
在 `runTask.ts` 初始化时传入 `SecretProvider` 实例给 `AgentRuntime` 和 `McpHub`。

- [x] **Step 3: 测试并提交**
```bash
npm test
git add src/core/secretProvider.ts src/agents/agentRuntime.ts src/cli/runTask.ts
git commit -m "feat: abstract credential management via SecretProvider interface"
```

---

### Task 4: RBAC & 多租户管控基建

**Files:**
- Create: `src/core/auth.ts`
- Modify: `src/core/webHub.ts`
- Modify: `src/tools/toolGateway.ts`

- [x] **Step 1: WebSocket JWT 鉴权**
修改 `WebHub`，强制要求传入合法的 JWT Token 才能建立连接，隔离不同团队的数据流。

- [x] **Step 2: 工具维度权限控制**
修改 `ToolGateway`，在执行高危动作（如写入文件）前，校验当前上下文附带的 User Role 是否具备执行该 MCP 工具的权限。

- [x] **Step 3: 测试并提交**
```bash
npm test
git add src/core/auth.ts src/core/webHub.ts src/tools/toolGateway.ts
git commit -m "feat: add basic RBAC middleware for WebSocket and Tool executions"
```
