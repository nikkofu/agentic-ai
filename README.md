# Agentic Runtime Kernel

`agentic-ai` 是一个基于 TypeScript 开发的高性能、可观测且具备韧性的多 Agent 调度运行时内核。它旨在为复杂的 Agent 任务提供结构化的执行环境，支持从简单的单节点任务到分布式的复杂 DAG 工作流调度。

当前版本：`0.5.0`

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

## 📄 开源协议

本项目采用 [Apache-2.0](LICENSE) 协议。
