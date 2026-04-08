# Advanced Scheduling & Rate Limiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 实现 `RequestLimiter` 流量整形器和 `PriorityQueue` 优先级调度器，增强系统在高并发场景下的稳定性和关键任务响应能力。

**Architecture:** `RequestLimiter` 拦截 LLM 调用实现令牌桶算法。`Orchestrator` 使用 `PriorityQueue` 管理并行节点。

**Tech Stack:** TypeScript, Vitest.

---

### Task 1: 实现 RequestLimiter (令牌桶算法)

**Files:**
- Create: `src/core/limiter.ts`
- Test: `tests/unit/limiter.test.ts`

- [x] **Step 1: 编写 RequestLimiter 类**
实现 `acquire()` 方法，支持容量 (capacity) 和填充速率 (refillRatePerSecond)。使用 `setTimeout` 处理令牌等待。

- [x] **Step 2: 编写单元测试**
使用 `vi.useFakeTimers()` 验证：
  - 突发流量 (Burst) 是否被允许。
  - 超过容量时请求是否被延迟。
  - 令牌是否按速率填充。

- [x] **Step 3: 运行测试并通过**
```bash
npx vitest tests/unit/limiter.test.ts
```

- [x] **Step 4: Commit**
```bash
git add src/core/limiter.ts tests/unit/limiter.test.ts
git commit -m "feat: implement RequestLimiter with token bucket algorithm"
```

---

### Task 2: 配置集成与 Schema 更新

**Files:**
- Modify: `src/types/runtime.ts`
- Modify: `config/runtime.yaml`

- [x] **Step 1: 更新 RuntimeConfig Schema**
在 `scheduler` 块下增加 `rate_limit` 定义：
```typescript
rate_limit: z.object({
  requests_per_minute: z.number().int().positive(),
  burst_capacity: z.number().int().positive()
}).optional()
```

- [x] **Step 2: 更新默认配置文件**
在 `config/runtime.yaml` 中设置默认限流值。

- [x] **Step 3: Commit**
```bash
git add src/types/runtime.ts config/runtime.yaml
git commit -m "chore: add rate limit configuration schema"
```

---

### Task 3: 在 AgentRuntime 中集成限流

**Files:**
- Modify: `src/agents/agentRuntime.ts`
- Test: `tests/unit/agentRuntime-limiter.test.ts`

- [x] **Step 1: 修改 AgentRuntime 依赖**
使 `createAgentRuntime` 接收可选的 `limiter: RequestLimiter`。

- [x] **Step 2: 注入限流拦截**
在 `run()` 方法中，如果是 `openrouter` 模式且存在 `limiter`，在调用 `generate` 前执行 `await limiter.acquire()`。

- [x] **Step 3: 编写测试验证限流生效**
验证在多次并发调用 `run()` 时，LLM 调用间隔符合限流设置。

- [x] **Step 4: Commit**
```bash
git add src/agents/agentRuntime.ts tests/unit/agentRuntime-limiter.test.ts
git commit -m "feat: integrate RequestLimiter into AgentRuntime"
```

---

### Task 4: 实现优先级调度逻辑

**Files:**
- Modify: `src/core/orchestrator.ts`
- Test: `tests/unit/orchestrator-priority.test.ts`

- [x] **Step 1: 更新并行节点输入类型**
为 `ParallelNodeInput` 增加可选的 `priority?: number` 字段。

- [x] **Step 2: 重构 runParallelTask 使用优先级排序**
在将节点加入 `queue` 前，按 `priority` 从大到小排序。

- [x] **Step 3: 编写优先级调度测试**
验证在 `maxParallel` 受限时，高优先级节点先于低优先级节点启动执行。

- [x] **Step 4: Commit**
```bash
git add src/core/orchestrator.ts tests/unit/orchestrator-priority.test.ts
git commit -m "feat: support priority-based scheduling in runParallelTask"
```

---

### Task 5: 全链路集成与回归

**Files:**
- Modify: `src/cli/runTask.ts`

- [x] **Step 1: 在 CLI 中初始化全局限流器**
根据 `config.scheduler.rate_limit` 创建单例 `RequestLimiter`。

- [x] **Step 2: 运行全量测试**
确保新功能未破坏原有并行和持久化逻辑。
```bash
npm test
```

- [x] **Step 3: Commit**
```bash
git add src/cli/runTask.ts
git commit -m "feat: enable rate limiting by default in CLI"
```
