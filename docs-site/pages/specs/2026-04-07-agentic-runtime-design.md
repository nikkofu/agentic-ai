# 全智能多 Agent 调度系统设计（MVP）

- 日期：2026-04-07
- 阶段：子项目 A（调度与执行内核优先）
- 范围：单机多 agent、无 mock 决策链路、端到端自动闭环

## 1. 目标与边界

### 1.1 目标
构建一个以 LLM 为核心决策引擎的多 Agent 运行时，通过 `loop + agent + evaluate` 驱动任务执行，具备以下能力：

1. 多角色标准 Agent（planner/researcher/coder/writer）协同
2. 子 Agent 递归派生（受护栏控制）
3. 可插拔调度策略（默认 BFS，可切换 DFS）
4. 工具调用统一网关（MVP：Local Tool + MCP）
5. 结构化 Prompt 自动拼接
6. 评估器三维打分（质量/成本/延迟）并反向驱动流程决策

### 1.2 非目标（MVP 不做）

1. 分布式跨节点调度
2. gRPC/JSON-RPC 实际接入（仅预留扩展位）
3. 完整 React+Ink 交互工作台（后续阶段）
4. 非必要配置体系与高级自治策略

## 2. 技术决策（已确认）

1. 运行时语言：TypeScript + Node.js
2. 部署形态：单机多 Agent
3. 调度策略：策略可插拔，默认 BFS
4. 评估维度：质量 + 成本 + 延迟
5. 工具面：Local Tool + Remote MCP（先行）
6. 递归控制：强制护栏（深度/分支/步数/预算）
7. Prompt 机制：结构化模板
8. 验收优先级：端到端自动闭环稳定跑通
9. 架构方案：事件驱动内核 + 可插拔策略/评估

## 3. 总体架构

系统由 8 个核心模块组成：

1. **Orchestrator Core**
   - 接收任务、创建 TaskGraph、推进生命周期。
2. **Scheduler**
   - 实现策略接口，默认 BFS，可切换 DFS。
3. **Agent Runtime**
   - 管理角色 Agent 执行与子 Agent 递归派生。
4. **Prompt Composer**
   - 基于结构化模板拼装每轮 prompt。
5. **Tool Gateway**
   - 统一适配 Local Tool 与 MCP。
6. **Model Router**
   - 对接 OpenRouter Responses API，路由模型与 reasoner 等级。
7. **Evaluator**
   - 计算质量/成本/延迟评分，输出流程决策。
8. **Guardrails**
   - 执行递归与预算约束，超限熔断。

## 4. 事件驱动数据流

### 4.1 主流程

1. `TaskSubmitted`
2. Orchestrator 初始化 `TaskGraph` 与 `frontier`
3. Scheduler 依据策略选取节点
4. Agent Runtime 运行节点，Prompt Composer 生成 prompt
5. Model Router 调 OpenRouter Responses API
6. 如需工具调用，经 Tool Gateway 执行并回填
7. Evaluator 输出决策：`continue | revise | stop | escalate`
8. Orchestrator 按决策推进：
   - `continue`：推进当前节点或创建子节点
   - `revise`：同节点重试（允许调整模型/推理等级）
   - `stop`：节点完成并汇总
   - `escalate`：升级高等级模型或人工介入
9. `TaskClosed`

### 4.2 节点状态机

`pending -> running -> waiting_tool -> evaluating -> completed | failed | aborted`

### 4.3 事件最小集合

- TaskSubmitted
- NodeScheduled
- AgentStarted
- PromptComposed
- ModelCalled
- ToolInvoked
- ToolReturned
- Evaluated
- NodeRetried
- ChildSpawned
- NodeCompleted
- TaskClosed
- GuardrailTripped

## 5. 模块职责与接口（MVP）

### 5.1 Scheduler

- `select(frontier, policy): NodeRef`
- `policy` 支持 `bfs | dfs`
- 支持后续扩展 `hybrid`

### 5.2 Agent Runtime

- `run(node, runtimeCtx): AgentResult`
- 负责：
  - 调用 Prompt Composer
  - 调用 Model Router
  - 发起 Tool Gateway
  - 决定是否申请派生子 Agent（先过 Guardrails）

### 5.3 Prompt Composer

结构化模板：

- `system`
- `role`
- `task`
- `context`
- `tools`
- `memory`
- `constraints`
- `output_schema`

输出为 OpenRouter Responses API 所需 payload。

### 5.4 Tool Gateway

- `invoke(toolCall): ToolResult`
- 统一返回格式：
  - `ok`
  - `data`
  - `error`
  - `latencyMs`
  - `costMeta`

### 5.5 Model Router

- `generate(request): LlmResponse`
- 基于 role + 当前阶段 +预算动态选模型/推理等级。

### 5.7 核心数据结构（最小必需）

为避免实现阶段理解偏差，MVP 锁定以下最小 schema：

```ts
type TaskGraph = {
  taskId: string;
  rootNodeId: string;
  frontier: string[]; // 待调度节点队列/栈，由 policy 解释
  nodes: Record<string, TaskNode>;
  status: "running" | "completed" | "failed" | "aborted";
  createdAt: string;
};

type TaskNode = {
  nodeId: string;
  parentNodeId?: string;
  role: "planner" | "researcher" | "coder" | "writer";
  state: "pending" | "running" | "waiting_tool" | "evaluating" | "completed" | "failed" | "aborted";
  depth: number;
  attempt: number;
  inputSummary: string;
  outputSummary?: string;
  children: string[];
  metrics?: {
    qualityScore?: number;
    costScore?: number;
    latencyScore?: number;
    totalScore?: number;
    latencyMs?: number;
    costUsd?: number;
  };
};

type EvalDecision = {
  decision: "continue" | "revise" | "stop" | "escalate";
  reason: string;
  scores: {
    quality: number; // 0-1
    cost: number;    // 0-1（越高越好）
    latency: number; // 0-1（越高越好）
    total: number;   // 0-1
  };
};
```

### 5.8 决策阈值（MVP 固定默认）

Evaluator 默认阈值：

- `total >= 0.75` -> `continue`
- `0.55 <= total < 0.75` -> `revise`
- `total < 0.55` -> `stop`
- 任一硬条件触发 -> `escalate`

硬条件：

1. 连续 2 次 `revise` 仍无质量提升（提升 < 0.05）
2. 命中 GuardrailTripped 且节点仍未完成
3. 工具调用出现不可恢复错误（认证/权限/协议不匹配）

> 说明：阈值为默认值，后续阶段可参数化。

## 6. 配置模型

统一配置（建议 `config/runtime.yaml`）：

```yaml
models:
  default: "openrouter:..."
  byAgentRole:
    planner: "..."
    researcher: "..."
    coder: "..."
    writer: "..."

reasoner:
  default: "medium"
  byAgentRole:
    planner: "high"
    researcher: "high"
    coder: "medium"
    writer: "low"

scheduler:
  defaultPolicy: "bfs"
  policyOverrides: {}

guardrails:
  max_depth: 4
  max_branch: 3
  max_steps: 60
  max_budget: 5.0

evaluator:
  weights:
    quality: 0.6
    cost: 0.2
    latency: 0.2
```

## 7. 护栏策略

在任意子 Agent 派生前执行：

1. 深度检查：`currentDepth < max_depth`
2. 分支检查：`childrenCount < max_branch`
3. 步数检查：`totalSteps < max_steps`
4. 预算检查：`spent < max_budget`

任一失败触发 `GuardrailTripped`，并由 Evaluator/Orchestrator 决定 `stop` 或 `escalate`。

## 8. 可观测性与可重放

MVP 即要求：

1. 每轮事件落盘（JSONL）
2. 每节点保留输入/输出摘要与评分
3. 任务结束产出执行摘要（路径、节点数、工具调用次数、总成本、总时延）

这保证后续可做：

- 失败定位
- 策略对比实验
- 调度重放与回归测试

## 9. 验收标准（MVP Definition of Done）

满足以下全部条件视为完成：

1. 给定任务可自动跑通完整链路：提交 -> 调度 -> 执行 -> 评估 -> 终止
2. 至少包含一次子 Agent 递归派生并被护栏约束
3. Local Tool 与 MCP 调用各至少成功一次
4. BFS/DFS 可配置切换，默认 BFS
5. 每轮评估均产出三维评分与决策
6. 任务完成后有结构化执行摘要
7. 连续多轮运行稳定（无死循环/无失控递归/无未处理状态）

## 10. 风险与缓解

1. **递归失控风险**
   - 缓解：硬护栏 + 熔断事件 + 强制终止路径
2. **评估偏差导致误决策**
   - 缓解：可配置权重 + 决策阈值可调 + 事件追踪复盘
3. **工具返回格式不一致**
   - 缓解：Tool Gateway 强制统一结果 schema
4. **模型成本波动**
   - 缓解：路由层按角色分配模型，超预算自动降级或终止

## 11. 下一步

本设计确认后，进入实现计划阶段：

1. 拆解为里程碑与任务依赖
2. 定义每里程碑可验证产物
3. 生成逐步 implementation plan
