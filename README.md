# Agentic Runtime Kernel

`agentic-ai` 是一个基于 TypeScript 开发的高性能、可观测且具备韧性的多 Agent 调度运行时内核。它旨在为复杂的 Agent 任务提供结构化的执行环境，支持从简单的单节点任务到分布式的复杂 DAG 工作流调度。

当前版本：`1.9.0`

## 🚀 核心特性

- **多模式调度**：支持 BFS/DFS 策略，以及基于依赖关系的 **声明式 DAG 工作流** 调度。
- **受控并行执行**：内置 `runParallelTask`，支持 `max_parallel` 并发限制与节点优先级队列。
- **递归安全护栏 (Guardrails)**：动态监控深度、分支、步数及预算消耗，防止资源失控。
- **生产级韧性**：内置 OpenAI 兼容接口支持、指数退避重试 (429/5xx) 及模型自动回退 (Fallback)。
- **自主研究闭环**：支持 `web_search`、`page_fetch`、`github_readme`、`github_file`、`verify_sources` 等研究工具回环。
- **全链路可观测性**：OpenTelemetry 追踪、JSONL 事件持久化，以及醒目的财务成本摘要。
- **多端 ChatOps**：支持通过 **Slack** 和 **WhatsApp** 实时推送任务状态。
- **产品化打磨**：内置 **Preflight 诊断**、**交互式 init 向导**、**模板系统** 及 **Adoption 报告** 生成。
- **真实交付约束**：空交付不会判定完成；研究型任务缺少 verification 证据会被阻断。
- **上下文原生 Runtime Core**：执行入口已经下沉到 `runtime executor + context-native orchestrator`，CLI 只负责适配输入输出。
- **策略驱动收敛**：`planner policy` 已进入 runtime enforcement，`evaluator + policy` 联合决定 `stop / revise / block`。
- **能力与记忆底座**：已接入 capability routing、retrieval provider、task-scoped memory write-back 和 tree-wide summary persistence。
- **任务控制面闭环**：已提供统一 `task lifecycle` 服务，支持 `start / resume / inspect / close`，并通过 CLI、queue worker 与 Dashboard API 共享同一条控制链。
- **异步执行可视化**：queue-backed parallel node execution、worker 回流事件、Dashboard 生命周期面板与异步任务状态展示已经打通。
- **分布式闭环增强**：queued node 具备 ownership/dedupe 元数据，shared task graph 会同步 async node/task writeback、distributed join readiness 与 resume/replay 恢复语义。
- **统一生产 Prompt Pipeline**：`ExecutionContext` 现在通过单一 `promptComposer` 渲染为结构化生产 prompt payload，减少运行时 prompt 分叉。
- **Typed Invalid Output Taxonomy**：runtime 会显式分类 `invalid_protocol`、`empty_delivery`、`verification_missing` 等无效输出，并决定 repair 或 block。
- **语义 Tool Loop 识别**：重复发出等价 tool-call 的节点现在会被明确分类为 `semantic_tool_loop`，避免继续漂到泛化的耗尽状态。
- **Evaluator 唯一收敛权威**：节点只有在 evaluator 明确给出 `deliver` 时才会完成，避免隐式 stop 路径伪完成。
- **Typed Planner Join Decisions**：planner/join 决策开始统一到 `deliver / revise_child / spawn_more / block / queued`，减少 stringly-typed 分支漂移。
- **产品化 Runtime Inspector**：Dashboard 开始按 `Intent / Plan / Delivery / Runtime` 分区展示任务状态、证据、artifact 真值和解释链路。
- **交付物真值展示**：inspection 会返回 artifact 是否存在、是否非空，以及 verification 预览，不再只展示计数。
- **可执行解释层**：UI 已统一展示 `explanation + actionHint`，把完成、阻断、失败转成更可读且可执行的用户提示。
- **Gold-Path 产品证明补齐**：当前已具备三条产品化 proof：
  - research-writing 成功/阻断
  - code edit + test 成功交付
  - async resume after interruption
- **Phase 14 真实交付平台**：新增 `research_writing` 与 `browser_workflow` 两类一等公民任务族，开始围绕可信内容交付与高自动化流程交付构建 family-aware delivery harness。
- **Research Trust Pipeline**：research 任务现在会统计 distinct source coverage、输出 `references.json`，并在 inspector 里展示 `sourceCoverage / verifiedClaimCount / referencesPreview`。
- **Browser Automation Proof**：browser workflow 任务现在会记录 `stepCount / lastSuccessfulStep / validationSummary / recoveryAttempts`，并在 inspector 中以 run-proof 形式展示。
- **Family-Aware 解释层**：research 与 browser 的阻断/完成解释和下一步建议现在按任务族分别表达，不再只用通用 blocked/completed 文案。
- **QA / Verifier Harness**：新增 verifier acceptance boundary，开始区分 “已产出 delivery” 与 “已通过 verifier 接受的 delivery”。
- **Acceptance Proof**：research/browser 两类任务都会生成 verifier decision、verifier summary、typed findings，并在 inspector 中可见。
- **拒收与修订语义**：research/browser 交付现在可以被 verifier 标记为 `accept / revise / reject`，最终 handoff 只在接受后完成。
- **Phase 16 三层记忆系统**：新增 `personal / project / task` 三层 memory productization，支持 `raw / curated / compressed` 状态、markdown-first 存储和层级化检索注入。
- **Dream Runtime**：新增安全的空闲期 Dream runtime，可在后台生成 reflections、hypotheses、skill drafts 和 recommendations，默认不执行外部动作。
- **Memory Inspector**：Dashboard 现在会展示 personal/project/task memory 摘要以及 Dream 输出预览。
- **Phase 16 Closure**：默认 runtime 现在会接通 live memory / Dream inspector，project memory 会自动 curate/compress，Dream 具备安全 idle trigger，MemoryPanel 会展示空态与 freshness truth。
- **Phase 17 持续助理界面完成**：WhatsApp continuity、durable conversation persistence、Conversation Service、thread/link/event 持久化、以及面向 thread 的 control center 已经收口。
- **完整 Control Center**：Dashboard 现在已有 `Assistant / Work Queue / Thread Detail / Follow Up / Conversation / Conversation List / Companionship` 七块协同视图，支持 thread 导航、过滤、inspect、resume、approve、reject、clarify。
- **更完整 HITL 闭环**：`awaiting_user_input` 线程现在能在 Work Queue 中触发真实 `approve / reject / clarify` 动作，并通过 `taskLifecycle -> executor -> orchestrator.resumeHitl` 贯通。
- **生产级 WhatsApp Continuity**：Adapter 现在具备连接状态显式化、消息去重、assistant channel-state 暴露，以及 richer inbound flow proof。
- **Phase 18 深度记忆演化**：三层记忆现在具备 trust gate、promotion/compression、history/rollback、stale/superseded 生命周期，以及由 Dream 驱动的 skill candidate 演化。
- **记忆演化真值面板**：Dashboard 开始展示 memory evolution timeline、status truth、skill candidates 和 companionship memory，不再只展示静态 memory count。
- **Phase 19 Completion Harness**：runtime 现在会记录 benchmark/completion evidence、聚合 task-family completion/acceptance rate，并把 release gate readiness 暴露到 inspection 与 dashboard。
- **Phase 20 Operator Intelligence**：Dashboard 现在具备面向企业管理员的 Executive Layer 与面向高级操作者的 Operator Layer，统一呈现 outcome、economics、risk、trust、queue、objective performance 与 runtime drilldown。

## 🖥️ 可视化 Dashboard

项目内置了实时的 Web 可视化面板，使用 React Flow 动态呈现 Agent 调用树：

1. **启动 UI 服务**：
   ```bash
   npm run ui:dev
   ```
2. **实时监控**：运行任务时，控制台会打印 Dashboard URL（ws 驱动，毫秒级同步）。打开链接即可观察任务图流转与节点详情。

## 🍱 用例画廊 (Recipes)

我们在 `recipes/` 目录提供了一系列端到端案例供您参考：
- **01-GitHub Issue Solver**：自动定位并修复代码库中的 Bug。
- **02-Financial Report Generator**：利用 DAG 工作流并行抓取数据并生成研报。

## 📖 使用指南

### 快速开始
```bash
npm install
npx tsx src/cli/runTask.ts init  # 交互式初始化环境
```

### 运行任务
```bash
npx tsx src/cli/runTask.ts -p "执行任务描述" --verbose
npx tsx src/cli/runTask.ts --workflow my-dag.yaml  # 运行 DAG 工作流
npx tsx src/cli/runTask.ts --template research -p "量子计算" # 使用模板
```

### 交付物与运行日志

- 成功交付物写入 `artifacts/`，文件名使用可读 slug，便于直接交付给用户。
- 运行日志与阻断任务记录写入 `logs/runs/<taskId>/delivery.json`。
- 若交付物是文件，runtime 会在退出前校验文件真实存在且非空。
- 调研类任务如果没有来源验证信息，不会被标记为完成。
- `diary/` 与 `memory/` 为本地专用目录，默认被 `.gitignore` 忽略，不参与远端仓库同步。
- `diary/` 可用于保存本地发版日记；`memory/` 可用于保存本地任务记忆、项目记忆和临时状态。

### 进入交互式 REPL
```bash
npx tsx src/cli/runTask.ts --repl
```

## 📄 路线图

- [x] **Phase 1**: MVP 核心运行时（调度、护栏、评估器、本地工具）。
- [x] **Phase 2**: 运行时增强（通配符事件、JSONL 持久化、重试/回退、受控并行）。
- [x] **Phase 3**: 生产级扩展（Prisma 持久化、多 MCP 枢纽、限流、遥测、Web 看板）。
- [x] **Phase 4**: UX 优化、入口统一、可视化状态高亮。
- [x] **Phase 5**: 预检校验、模板系统、标准化诊断输出。
- [x] **Phase 6**: 团队协作视图、高风险审计追踪、Adoption 报告。
- [x] **Phase 7**: 生态插件、SKILL Registry、DAG 引擎。
- [x] **Phase 8**: 极致 DX、交互脚手架、OpenAI 兼容本地沙盒。
- [x] **Phase 9**: 分布式架构基建、凭证保险箱、RBAC 管控。
- [x] **Phase 10**: 社区增长、用例画廊、交互文档、WhatsApp 集成。
- [x] **Phase 11**: 分布式闭环，queued ownership/dedupe、async writeback、distributed join、resume/replay 恢复。
- [x] **Phase 12**: Agent 智能化内核，统一 prompt pipeline、typed invalid-output taxonomy、evaluator authority、planner policy enforcement。
- [x] **Phase 13**: 用户产品化，runtime inspector、artifact truth、统一 explanation、gold-path 产品证明。
- [x] **Phase 14**: 真实交付平台，task-family-aware delivery harness、research trust pipeline、browser workflow automation、family-aware product surface。
- [x] **Phase 15**: QA / Verifier Harness，acceptance proof、typed findings、research/browser verifier flow、verifier-enforced handoff。
- [x] **Phase 16**: Memory Productization & Dream Runtime，三层记忆、memory engine、bounded memory injection、Dream 反思与产品化 memory surface。
- [x] **Phase 16 Closure**: 默认 memory/dream inspector 接线、auto-curate/compress、demote/forget、safe Dream idle trigger、memory product truth。
- [x] **Phase 17**: Persistent Assistant Surface 完成，WhatsApp continuity、durable conversation persistence、完整 Control Center、richer HITL workflow、Companionship Layer。
- [x] **Phase 18**: Deep Memory Evolution，trust model、promotion/compression、history/rollback、Dream-to-skill candidate、companionship memory、memory evolution product surface。
- [x] **Phase 19**: Completion Harness，benchmark/completion ledger、task-family scorecard、release gate、completion evidence product surface。
- [x] **Phase 20**: Operator Intelligence，Executive Layer、Operator Layer、outcome/economics/risk/trust metrics、objective performance、intervention queue summary。

## 📄 开源协议

本项目采用 [Apache-2.0](LICENSE) 协议。
