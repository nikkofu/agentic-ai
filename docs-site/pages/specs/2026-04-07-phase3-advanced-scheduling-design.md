# Phase 3: Advanced Scheduling & Rate Limiting Design Spec

本项目 Phase 3 的核心任务是引入精细化的资源管理机制，包括基于令牌桶的请求限流器和基于优先级队列的节点调度器。

## 1. 目标 (Objectives)
- **主动避让 (Traffic Shaping)**：在客户端侧控制 LLM API 的并发请求频率，减少 429 错误的发生。
- **关键任务优先**：支持为节点指定优先级，确保核心编排节点（如 Planner）优先获得执行资源。
- **配置化配额管理**：支持在 YAML 中灵活配置全局及单任务的限流策略。

## 2. 核心组件

### 2.1 令牌桶限流器 (`RequestLimiter`)
实现标准的令牌桶算法，控制请求通过的速率。
- `capacity`：桶的最大容量（允许的最大突发请求数）。
- `refillRatePerSecond`：令牌填充速率。
- `acquire()`：异步方法，令牌不足时等待直至获得许可。

### 2.2 优先级任务队列 (`PriorityQueue`)
一个内部组件，用于在并行执行时管理待处理节点。
- 排序规则：`priority` 数值越大（Int），位置越靠前。
- 稳定性：相同优先级的节点按进入队列的先后顺序排序。

## 3. 接口变更

### 3.1 配置文件 (`config/runtime.yaml`)
```yaml
scheduler:
  default_policy: "bfs"
  rate_limit:
    requests_per_minute: 60
    burst_capacity: 5
```

### 3.2 Orchestrator 输入类型
```typescript
type ParallelNodeInput = {
  nodeId: string;
  role: AgentRole;
  priority?: number; // 新增：默认为 0
};
```

### 3.3 AgentRuntime 依赖
`AgentRuntime` 将引入可选的 `limiter` 实例。

## 4. 详细流程 (Data Flow)

1. **调度阶段**：
   - `Orchestrator.runParallelTask` 接收带有优先级的节点列表。
   - 节点被推入 `PriorityQueue`。
   - 当 Worker 空闲时，从队列头部取出最高优先级的节点。

2. **执行阶段**：
   - 节点进入 `AgentRuntime.run`。
   - 在执行 `generate` 调用前，Runtime 调用 `await limiter.acquire()`。
   - 如果令牌充足，立即扣减并执行 LLM 调用。
   - 如果令牌不足，Runtime 进入非阻塞等待状态，直到限流器释放许可。

## 5. 错误处理与健壮性
- **等待超时**：如果 `limiter.acquire()` 等待时间超过阈值（如 60s），抛出 `LIMITER_TIMEOUT` 错误。
- **动态调整**：虽然初版不支持动态调整速率，但架构上预留 `updateRate()` 接口。

## 6. 测试策略
- **Limiter Unit Tests**：使用模拟时钟 (Mock Timers) 验证限流速率和突发处理。
- **Priority Queue Tests**：验证不同优先级节点进入队列后的取出顺序。
- **Integration Tests**：在高并发模拟下，验证系统是否能稳定按速率发送请求，并优先完成高优先级节点。
