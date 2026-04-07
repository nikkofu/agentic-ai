# Phase 3: Observability & Cost Center Design Spec

本项目 Phase 3 的观测任务旨在引入标准化的遥测机制 (Telemetry) 和精确的成本核算模型，使 Agent 的执行过程全链路透明且财务可控。

## 1. 目标 (Objectives)
- **全链路追踪 (Tracing)**：记录 Agent 任务从提交、调度、模型调用到工具执行的完整 Span 树。
- **实时指标 (Metrics)**：统计 Token 消耗速率、LLM 响应时延分布及累计成本。
- **精确计费 (Cost Accounting)**：根据模型单价和真实 Usage 实时核算每一步调用的 USD 消耗。
- **离线分析能力**：支持将 Trace 数据导出至兼容 OTLP 的后端或本地日志。

## 2. 核心组件设计

### 2.1 遥测引擎 (`TelemetryManager`)
封装 OpenTelemetry SDK，提供统一的 API 供其他模块调用。
- **Span 管理**：支持 `startSpan(name, attributes)`，自动处理父子上下文关联。
- **指标上报**：维护 `Counter` (Token/Cost) 和 `Histogram` (Latency)。

### 2.2 成本中心 (`CostCenter`)
负责将 Usage 数据转换为财务数据。
- **模型价格表**：维护常用模型（OpenRouter 系列）的 Prompt/Completion 单价映射。
- **计费逻辑**：支持基于 Token 数的线性计费，并支持 MCP 工具的自定义成本（如有）。

## 3. 拦截点与集成实现

### 3.1 LLM 响应处理适配
修改 `OpenRouterGenerateResponse` 以包含 `usage`：
```typescript
type LLMUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

type OpenRouterGenerateResponse = {
  outputText: string;
  usage: LLMUsage;
  raw: any;
};
```

### 3.2 AgentRuntime 装饰器
在 `run()` 方法中：
1. 启动 `llm_generate` Span。
2. 调用结束后，从响应中提取 `usage`。
3. 调用 `CostCenter.calculate(model, usage)`。
4. 更新 `tokenCounter` 和 `costCounter` 指标。
5. 在 Span 上附加 `tokens` 和 `usd_cost` 属性。

### 3.3 Orchestrator 链路透传
- 根任务启动时生成全局唯一的 `trace_id`。
- 通过 Context 将 Trace 上下文透传给并行执行的各个节点 Span。

## 4. 数据输出与导出

### 4.1 CLI 摘要输出
任务完成后的 `RunTaskResult` 增加财务摘要字段：
- `total_duration_ms`: 总执行时长。
- `total_tokens`: 累计消耗 Token。
- `total_cost_usd`: 累计消耗美元。

### 4.2 导出配置 (`runtime.yaml`)
```yaml
telemetry:
  enabled: true
  export_format: "console" # 选项: console, otlp, json
  otlp_endpoint: "http://localhost:4318" # 可选的 OTLP 收集器地址
```

## 5. 测试策略
- **Usage Extraction Test**：验证能否正确从 OpenRouter Mock 响应中解析出 Token 数。
- **Cost Calculation Test**：验证针对不同价格阶梯的模型，成本计算是否精准。
- **Trace Context Propagation Test**：验证并行节点生成的 Span 是否能正确关联到父 Span。
