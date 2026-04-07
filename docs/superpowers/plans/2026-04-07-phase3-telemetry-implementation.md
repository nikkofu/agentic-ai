# Observability & Cost Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现基于 OpenTelemetry 的全链路追踪和基于真实 Usage 的成本核算系统。

**Architecture:** `TelemetryManager` 封装 SDK 提供追踪 API。`CostCenter` 提供财务计算逻辑。拦截 LLM 调用以捕获 Usage 并更新指标。

**Tech Stack:** @opentelemetry/api, @opentelemetry/sdk-node, TypeScript, Vitest.

---

### Task 1: 基础设施与 SDK 初始化

**Files:**
- Create: `src/core/telemetry.ts`
- Modify: `package.json`

- [ ] **Step 1: 安装 OpenTelemetry 依赖**
```bash
npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/resources @opentelemetry/semantic-conventions
```

- [ ] **Step 2: 实现 TelemetryManager**
创建 `src/core/telemetry.ts`，导出 `tracer`, `meter` 以及初始化函数 `initTelemetry()`。支持控制台导出作为默认选项。

- [ ] **Step 3: Commit**
```bash
git add src/core/telemetry.ts package.json package-lock.json
git commit -m "chore: setup opentelemetry infrastructure"
```

---

### Task 2: 实现成本中心 (CostCenter)

**Files:**
- Create: `src/core/costCenter.ts`
- Test: `tests/unit/costCenter.test.ts`

- [ ] **Step 1: 编写 CostCenter 逻辑**
实现 `calculateCost(model, usage)`。内置模型价格表（支持 OpenRouter 常用模型）。

- [ ] **Step 2: 编写单元测试**
验证：
  - 免费模型（如 qwen-plus:free）成本为 0。
  - 收费模型按比例准确计算 Prompt 和 Completion 费用。

- [ ] **Step 3: 运行测试并通过**
```bash
npx vitest tests/unit/costCenter.test.ts
```

- [ ] **Step 4: Commit**
```bash
git add src/core/costCenter.ts tests/unit/costCenter.test.ts
git commit -m "feat: implement CostCenter with model pricing table"
```

---

### Task 3: 增强 LLM 响应提取 Usage

**Files:**
- Modify: `src/model/openrouterClient.ts`
- Test: `tests/unit/openrouterClient-usage.test.ts`

- [ ] **Step 1: 更新响应类型定义**
为 `OpenRouterGenerateResponse` 增加 `usage` 字段。

- [ ] **Step 2: 适配 fetch 逻辑**
从 OpenRouter JSON 响应中提取 `usage` 对象。如果缺失，提供默认 0 值对象。

- [ ] **Step 3: 编写测试验证 Usage 提取**
模拟包含真实 `usage` 字段的响应并验证解析。

- [ ] **Step 4: Commit**
```bash
git add src/model/openrouterClient.ts tests/unit/openrouterClient-usage.test.ts
git commit -m "feat: extract usage data from OpenRouter responses"
```

---

### Task 4: 在 AgentRuntime 中集成全链路追踪

**Files:**
- Modify: `src/agents/agentRuntime.ts`
- Test: `tests/unit/agentRuntime-telemetry.test.ts`

- [ ] **Step 1: 注入 Span 生命周期**
在 `run()` 方法中：
  - 开启 `agent_run` Span。
  - 调用结束后，将 `tokens` 和 `cost` 附加为 Span Attribute。
  - 上报 Metrics (Counter)。

- [ ] **Step 2: 编写测试验证 Span 属性**
验证 Span 结束后是否包含正确的 `llm.usage.total_tokens` 等属性。

- [ ] **Step 3: Commit**
```bash
git add src/agents/agentRuntime.ts tests/unit/agentRuntime-telemetry.test.ts
git commit -m "feat: trace agent execution spans and report metrics"
```

---

### Task 5: 全局集成与 CLI 报告

**Files:**
- Modify: `src/cli/runTask.ts`
- Modify: `src/core/orchestrator.ts`

- [ ] **Step 1: 开启全局 Telemetry**
在 CLI 入口处调用 `initTelemetry()`。

- [ ] **Step 2: 聚合任务摘要**
修改 `runTask` 返回值，通过 `EventLogStore` 或 `Metrics` 汇总整个任务的 `total_cost_usd` 和 `total_tokens`。

- [ ] **Step 3: 打印财务摘要**
在 CLI 结束时输出格式化的成本报告。

- [ ] **Step 4: 运行全量回归并提交**
```bash
npm test
git add .
git commit -m "feat: finalize telemetry integration and cost reporting"
```
