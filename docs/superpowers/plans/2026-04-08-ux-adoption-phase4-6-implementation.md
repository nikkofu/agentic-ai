# UX & Adoption First (Phase M4-M6) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 在 3 个月内把现有 Runtime 从“功能已具备”推进到“高采用率、低学习成本、团队可运营”的产品形态。

**Architecture:** 采用“体验层优先”的增量改造：先统一 CLI/REPL/Dashboard 的交互契约，再补齐上手与诊断闭环，最后建设团队协作视图与 adoption 指标导出。核心 runtime/orchestrator 保持稳定，仅在入口层、观测层与产品化层增加薄扩展。

**Tech Stack:** TypeScript, Node.js, Vitest, Next.js UI (React 19), WebSocket (`ws`), Zustand, existing EventBus/EventLog/TaskStore。

---

## 0) File Structure (planned changes)

### Create
- `src/cli/preflight.ts` — 启动前检查（env/config/dependency）
- `src/cli/adoptionReport.ts` — Adoption 指标聚合与导出
- `src/cli/templateCatalog.ts` — 内置模板目录与加载逻辑
- `src/core/teamViewProjector.ts` — 团队视图聚合器（由事件流投影）
- `src/core/auditTrail.ts` — 高风险操作审计写入接口
- `tests/unit/preflight.test.ts`
- `tests/unit/adoptionReport.test.ts`
- `tests/unit/templateCatalog.test.ts`
- `tests/unit/teamViewProjector.test.ts`
- `tests/unit/auditTrail.test.ts`
- `tests/unit/webHub-task-filter.test.ts`
- `tests/unit/runTask-dashboard-link.test.ts`
- `docs/templates/research-template.md`
- `docs/templates/execution-template.md`
- `docs/templates/multi-agent-template.md`

### Modify
- `src/cli/runTask.ts` — 参数统一、preflight/template/report 入口、dashboard 跳转
- `src/core/webHub.ts` — task 维度过滤、团队视图广播通道
- `src/core/eventSchemas.ts` — UX/adoption 事件 schema 补充
- `src/core/eventLogStore.ts` — 指标读取辅助接口（仅查询层）
- `src/tools/toolGateway.ts` — 高风险动作审计埋点
- `ui/hooks/useEventStream.ts` — 连接状态与过滤参数增强
- `ui/store/useTaskStore.ts` — 任务视图筛选与异常高亮状态
- `ui/components/MetricsSummary.tsx` — 增加恢复时长/模板命中指标展示
- `ui/components/GraphCanvas.tsx` — 节点异常高亮与快速定位
- `ui/components/NodeInspector.tsx` — 展示审计/异常上下文
- `ui/app/dashboard/page.tsx` — task/team 双视图入口
- `README.md` — Quickstart 2.0、模板、诊断与团队视图说明
- `ui/README.md` — dashboard 启动与过滤参数说明

---

### Task 1: 统一 CLI/REPL 命令契约（M4）

**Files:**
- Modify: `src/cli/runTask.ts`
- Test: `tests/unit/runTask-args.test.ts`
- Test: `tests/unit/repl-session.test.ts`

- [x] **Step 1: 写失败测试（命令契约）**
```ts
it("parses --input/-p, --verbose, --repl consistently", () => {
  const parsed = parseRunTaskArgs(["--repl", "--verbose", "-p", "hello"]);
  expect(parsed).toMatchObject({ repl: true, verbose: true, input: "hello" });
});
```

- [x] **Step 2: 运行测试确认失败**
Run: `npm test -- tests/unit/runTask-args.test.ts tests/unit/repl-session.test.ts`
Expected: FAIL（新增契约断言尚未实现）。

- [x] **Step 3: 最小实现命令契约统一**
- 在 `parseRunTaskArgs` 中统一 flag 优先级与默认值。
- 在 `processReplCommand` 中保证 `/approve|/reject|/exit` 与 CLI 命令语义一致。

- [x] **Step 4: 重新运行测试确认通过**
Run: `npm test -- tests/unit/runTask-args.test.ts tests/unit/repl-session.test.ts`
Expected: PASS。

- [x] **Step 5: Commit**
```bash
git add src/cli/runTask.ts tests/unit/runTask-args.test.ts tests/unit/repl-session.test.ts
git commit -m "feat: unify CLI and REPL command contract"
```

---

### Task 2: Dashboard 跳转与 task 过滤闭环（M4）

**Files:**
- Modify: `src/core/webHub.ts`
- Modify: `src/cli/runTask.ts`
- Modify: `ui/hooks/useEventStream.ts`
- Test: `tests/unit/webHub.test.ts`
- Create: `tests/unit/webHub-task-filter.test.ts`
- Create: `tests/unit/runTask-dashboard-link.test.ts`

- [x] **Step 1: 写失败测试（WebHub task 过滤）**
```ts
it("only broadcasts events matching client task_id filter", async () => {
  // client subscribes task-a; publish task-a + task-b; expect only task-a received
});
```

- [x] **Step 2: 写失败测试（CLI dashboard link）**
```ts
it("prints dashboard URL containing taskId", async () => {
  // spy console.log and assert http://localhost:3000/dashboard?taskId=...
});
```

- [x] **Step 3: 运行测试确认失败**
Run: `npm test -- tests/unit/webHub.test.ts tests/unit/webHub-task-filter.test.ts tests/unit/runTask-dashboard-link.test.ts`
Expected: FAIL。

- [x] **Step 4: 最小实现过滤与跳转链路**
- `webHub.ts` 解析连接 query 参数中的 `taskId`，仅推送匹配事件。
- `runTask.ts` 输出统一 dashboard URL（含 taskId）。
- `useEventStream.ts` 仅在存在 `taskId` 时连接并消费。

- [x] **Step 5: 重新运行测试确认通过**
Run: `npm test -- tests/unit/webHub.test.ts tests/unit/webHub-task-filter.test.ts tests/unit/runTask-dashboard-link.test.ts`
Expected: PASS。

- [x] **Step 6: Commit**
```bash
git add src/core/webHub.ts src/cli/runTask.ts ui/hooks/useEventStream.ts tests/unit/webHub.test.ts tests/unit/webHub-task-filter.test.ts tests/unit/runTask-dashboard-link.test.ts
git commit -m "feat: add dashboard deep-link and task-scoped websocket stream"
```

---

### Task 3: 异常可视化高亮与定位信息（M4）

**Files:**
- Modify: `ui/store/useTaskStore.ts`
- Modify: `ui/components/GraphCanvas.tsx`
- Modify: `ui/components/NodeInspector.tsx`
- Modify: `ui/components/MetricsSummary.tsx`
- Modify: `ui/types/events.ts`

- [x] **Step 1: 写失败测试（事件到状态映射）**
> 将映射逻辑从 store 中抽到纯函数（如 `mapRuntimeEventToNodeState`）并在 `tests/unit` 编写测试。
```ts
it("marks node as degraded on retry/fallback/guardrail events", () => {
  // expect highlight flags updated
});
```

- [x] **Step 2: 运行测试确认失败**
Run: `npm test -- tests/unit/orchestrator-state.test.ts`
Expected: FAIL（新增状态映射断言未满足）。

- [x] **Step 3: 最小实现异常高亮状态**
- `useTaskStore.ts` 维护 `degraded_reason` / `last_error` 视图字段。
- `GraphCanvas.tsx` 为异常节点应用显式样式。
- `NodeInspector.tsx` 展示最近一次关键异常上下文。

- [x] **Step 4: 重新运行测试确认通过**
Run: `npm test -- tests/unit/orchestrator-state.test.ts`
Expected: PASS。

- [x] **Step 5: Commit**
```bash
git add ui/store/useTaskStore.ts ui/components/GraphCanvas.tsx ui/components/NodeInspector.tsx ui/components/MetricsSummary.tsx ui/types/events.ts tests/unit/orchestrator-state.test.ts
git commit -m "feat: highlight degraded nodes and expose debug context in dashboard"
```

---

### Task 4: Quickstart 2.0 + Preflight（M5）

**Files:**
- Create: `src/cli/preflight.ts`
- Modify: `src/cli/runTask.ts`
- Create: `tests/unit/preflight.test.ts`
- Modify: `README.md`

- [x] **Step 1: 写失败测试（preflight 检查）**
```ts
it("fails with actionable message when OPENROUTER_API_KEY missing", async () => {
  // expect status=failed and fix command hint
});
```

- [x] **Step 2: 运行测试确认失败**
Run: `npm test -- tests/unit/preflight.test.ts`
Expected: FAIL。

- [x] **Step 3: 最小实现 preflight**
- 实现 env/config/mcp 关键检查。
- `runTask.ts` 支持 `--preflight` 并输出可执行修复提示。

- [x] **Step 4: 更新 README Quickstart 2.0**
- 新增“10 分钟首跑”路径：`install -> preflight -> run -> dashboard`。

- [x] **Step 5: 重新运行测试确认通过**
Run: `npm test -- tests/unit/preflight.test.ts`
Expected: PASS。

- [x] **Step 6: Commit**
```bash
git add src/cli/preflight.ts src/cli/runTask.ts tests/unit/preflight.test.ts README.md
git commit -m "feat: add preflight checks and quickstart 2.0 flow"
```

---

### Task 5: 模板目录与一键加载（M5）

**Files:**
- Create: `src/cli/templateCatalog.ts`
- Modify: `src/cli/runTask.ts`
- Create: `tests/unit/templateCatalog.test.ts`
- Create: `docs/templates/research-template.md`
- Create: `docs/templates/execution-template.md`
- Create: `docs/templates/multi-agent-template.md`
- Modify: `README.md`

- [x] **Step 1: 写失败测试（模板目录）**
```ts
it("returns built-in template by key", () => {
  expect(getTemplate("research")).toContain("Goal");
});
```

- [x] **Step 2: 运行测试确认失败**
Run: `npm test -- tests/unit/templateCatalog.test.ts`
Expected: FAIL。

- [x] **Step 3: 最小实现模板加载**
- `templateCatalog.ts` 支持 `research|execution|multi-agent`。
- `runTask.ts` 支持 `--template <name>` 并把模板注入输入。

- [x] **Step 4: 补充模板文档**
- 每个模板包含示例输入、预期输出、常见陷阱。

- [x] **Step 5: 重新运行测试确认通过**
Run: `npm test -- tests/unit/templateCatalog.test.ts`
Expected: PASS。

- [x] **Step 6: Commit**
```bash
git add src/cli/templateCatalog.ts src/cli/runTask.ts tests/unit/templateCatalog.test.ts docs/templates/research-template.md docs/templates/execution-template.md docs/templates/multi-agent-template.md README.md
git commit -m "feat: add built-in task templates and CLI template flag"
```

---

### Task 6: 错误可解释化（诊断输出标准化）（M5）

**Files:**
- Modify: `src/cli/runTask.ts`
- Modify: `src/core/eventSchemas.ts`
- Modify: `README.md`
- Test: `tests/integration/e2e-runtime.test.ts`

- [x] **Step 1: 写失败测试（错误输出含修复建议）**
```ts
it("prints cause + fix command + verify command on known failures", async () => {
  // force known error path; assert structured guidance output
});
```

- [x] **Step 2: 运行测试确认失败**
Run: `npm test -- tests/integration/e2e-runtime.test.ts`
Expected: FAIL。

- [x] **Step 3: 最小实现错误诊断结构**
- 标准字段：`reason`, `fix`, `verify`。
- 对常见错误（缺 key、模型不可达、MCP 连接失败）输出统一格式。

- [x] **Step 4: 重新运行测试确认通过**
Run: `npm test -- tests/integration/e2e-runtime.test.ts`
Expected: PASS。

- [x] **Step 5: Commit**
```bash
git add src/cli/runTask.ts src/core/eventSchemas.ts tests/integration/e2e-runtime.test.ts README.md
git commit -m "feat: standardize actionable diagnostics for common runtime failures"
```

---

### Task 7: 团队工作视图投影器（M6）

**Files:**
- Create: `src/core/teamViewProjector.ts`
- Modify: `src/core/webHub.ts`
- Modify: `ui/app/dashboard/page.tsx`
- Create: `tests/unit/teamViewProjector.test.ts`
- Modify: `ui/README.md`

- [x] **Step 1: 写失败测试（团队聚合投影）**
```ts
it("aggregates success rate and failure buckets per actor", () => {
  // feed synthetic events and assert per-actor stats
});
```

- [x] **Step 2: 运行测试确认失败**
Run: `npm test -- tests/unit/teamViewProjector.test.ts`
Expected: FAIL。

- [x] **Step 3: 最小实现 team view projector**
- 将事件流投影为团队维度统计结构（成员/任务组/时间窗）。
- `webHub.ts` 增加 team-view 频道广播。

- [x] **Step 4: 接入 dashboard 入口**
- `page.tsx` 增加 `view=task|team` 查询参数分支。

- [x] **Step 5: 重新运行测试确认通过**
Run: `npm test -- tests/unit/teamViewProjector.test.ts`
Expected: PASS。

- [x] **Step 6: Commit**
```bash
git add src/core/teamViewProjector.ts src/core/webHub.ts ui/app/dashboard/page.tsx tests/unit/teamViewProjector.test.ts ui/README.md
git commit -m "feat: add team-level dashboard projection and view mode"
```

---

### Task 8: 高风险操作审计闭环（M6）

**Files:**
- Create: `src/core/auditTrail.ts`
- Modify: `src/tools/toolGateway.ts`
- Modify: `src/cli/runTask.ts`
- Create: `tests/unit/auditTrail.test.ts`

- [x] **Step 1: 写失败测试（审计记录）**
```ts
it("writes audit records for high-risk tool actions", async () => {
  // invoke tool action tagged high-risk; assert audit log entry
});
```

- [x] **Step 2: 运行测试确认失败**
Run: `npm test -- tests/unit/auditTrail.test.ts`
Expected: FAIL。

- [x] **Step 3: 最小实现审计写入接口**
- `auditTrail.ts` 定义 `write(record)`。
- `toolGateway.ts` 在高风险调用前后写入审计事件。
- `runTask.ts` 可配置确认策略。

- [x] **Step 4: 重新运行测试确认通过**
Run: `npm test -- tests/unit/auditTrail.test.ts`
Expected: PASS。

- [x] **Step 5: Commit**
```bash
git add src/core/auditTrail.ts src/tools/toolGateway.ts src/cli/runTask.ts tests/unit/auditTrail.test.ts
git commit -m "feat: add configurable audit trail for high-risk actions"
```

---

### Task 9: Adoption 指标导出与月度报告基线（M6）

**Files:**
- Create: `src/cli/adoptionReport.ts`
- Modify: `src/core/eventLogStore.ts`
- Create: `tests/unit/adoptionReport.test.ts`
- Modify: `README.md`

- [x] **Step 1: 写失败测试（指标聚合）**
```ts
it("calculates WAU, success rate, MTTR, and template usage", () => {
  // feed event history; assert computed metrics
});
```

- [x] **Step 2: 运行测试确认失败**
Run: `npm test -- tests/unit/adoptionReport.test.ts`
Expected: FAIL。

- [x] **Step 3: 最小实现 adoption report 命令**
- 新增 `--report adoption --since <date>`。
- 输出结构化 JSON + 人类可读摘要。

- [x] **Step 4: 重新运行测试确认通过**
Run: `npm test -- tests/unit/adoptionReport.test.ts`
Expected: PASS。

- [x] **Step 5: 运行全量测试与构建**
Run: `npm run build && npm test`
Expected: PASS。

- [x] **Step 6: Commit**
```bash
git add src/cli/adoptionReport.ts src/core/eventLogStore.ts tests/unit/adoptionReport.test.ts README.md
git commit -m "feat: add adoption report command and monthly metrics baseline"
```

---

### Task 10: 最终验收与文档对齐

**Files:**
- Modify: `README.md`
- Modify: `ui/README.md`

- [x] **Step 1: 运行 M4-M6 关键冒烟路径**
Run:
- `npm test -- tests/unit/runTask-args.test.ts tests/unit/preflight.test.ts tests/unit/templateCatalog.test.ts tests/unit/teamViewProjector.test.ts tests/unit/auditTrail.test.ts tests/unit/adoptionReport.test.ts`
- `npm run build`
Expected: PASS。

- [x] **Step 2: 运行端到端体验冒烟**
Run:
- `npm run ui:dev`（单独终端）
- `npx tsx src/cli/runTask.ts --preflight`
- `npx tsx src/cli/runTask.ts -p "adoption smoke" --verbose`
Expected:
- preflight 成功或给出可执行修复建议。
- CLI 输出 dashboard 深链。
- Dashboard 能按 taskId 展示事件。

- [x] **Step 3: 文档对齐**
- README 增补：Quickstart 2.0、模板、诊断、report 命令。
- UI README 增补：task/team 视图与过滤参数。

- [x] **Step 4: Commit**
```bash
git add README.md ui/README.md
git commit -m "docs: finalize UX and adoption workflow documentation"
```
