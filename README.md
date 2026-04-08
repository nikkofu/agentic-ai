# Agentic Runtime Kernel

`agentic-ai` 是一个基于 TypeScript 开发的高性能、可观测且具备韧性的多 Agent 调度运行时内核。它旨在为复杂的 Agent 任务提供结构化的执行环境，支持从简单的单节点任务到受控的并行递归调度。

## 🚀 核心特性

- **受控并行调度**：内置 `runParallelTask` 支持，可根据 `max_parallel` 限制并发节点数，并在完成后进行结果合并 (Join)。
- **递归安全护栏 (Guardrails)**：动态监控执行深度、分支数、总步数及预算消耗，防止 Agent 陷入死循环或过度消耗资源。
- **多维度评估器 (Evaluator)**：基于质量 (Quality)、成本 (Cost) 和时延 (Latency) 进行加权打分，自动做出 `stop`、`continue` 或 `revise` 决策。
- **增强型韧性**：针对 LLM 调用（如 OpenRouter）内置了指数退避的重试机制（自动处理 429 错误）及模型自动回退 (Fallback) 链路。
- **全链路可观测性**：基于事件驱动架构，支持通配符订阅、实时事件流输出 (`--verbose`) 及基于 JSONL 的持久化日志存储。
- **交互式 REPL 模式**：支持在交互环境中运行任务，并支持人工介入进行修正审批 (`/approve`, `/reject`)。
- **规范化配置**：全项目遵循 `snake_case` (abc_def) 命名规范，支持 YAML 多层级配置合并。

## 🛠️ 环境要求

- **Node.js**: v18+ 
- **Package Manager**: npm

## 📦 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境
复制示例环境文件并填写您的 `OPENROUTER_API_KEY`：
```bash
cp .env.example .env
```

### 3. 运行 Preflight（Quickstart 2.0）
先执行启动前检查，确认关键环境可用：
```bash
npx tsx src/cli/runTask.ts --preflight
```

若失败，输出会包含：
- `reason`: 失败原因
- `fix`: 可执行修复步骤
- `verify`: 修复后验证命令

### 4. 配置文件
编辑 `config/runtime.yaml` 设置默认模型、调度策略和护栏限制：
```yaml
models:
  default: "qwen/qwen3.6-plus:free"
  fallback: ["qwen/qwen3.6-plus:free"]
retry:
  max_retries: 3
  base_delay_ms: 1000
```

## 📖 使用指南

### 运行单次任务
```bash
npx tsx src/cli/runTask.ts -p "请帮我规划一个旅行方案"
```

### 开启详细模式 (实时观察事件流)
```bash
npx tsx src/cli/runTask.ts -p "执行复杂任务" --verbose
```

### 进入交互式 REPL 模式
```bash
npx tsx src/cli/runTask.ts --repl
```
在 REPL 中，您可以使用：
- `/approve`: 批准修正建议。
- `/reject`: 拒绝修正建议。
- `/exit`: 退出会话。

### 模板驱动任务输入
可通过 `--template` 为输入注入内置模板前缀：
```bash
npx tsx src/cli/runTask.ts --template research -p "分析这个需求的关键风险"
```

内置模板：
- `research`
- `execution`
- `multi-agent`

### 常见失败的可解释诊断
当关键条件不满足（如缺少 API Key）时，CLI 将返回结构化诊断：
- `reason`: 失败原因
- `fix`: 建议修复步骤
- `verify`: 修复后验证命令

例如可先执行：
```bash
npx tsx src/cli/runTask.ts --preflight
```

### Adoption 指标导出
可导出 adoption 基线报告（当前返回结构化 JSON）：
```bash
npx tsx src/cli/runTask.ts --report adoption --since 2026-04-01
```

## 🍱 用例画廊

我们提供了两套端到端 Recipes，帮助你快速复用常见场景：

### [1. GitHub Issue 解决器](./recipes/01-github-issue-solver/)
- **核心工具**：`mcp-github` + `mcp-filesystem`
- **场景**：自动分析 GitHub Issue、定位本地代码并生成修复补丁。
- **快速体验**：
  ```bash
  npx tsx src/cli/runTask.ts -p "$(cat recipes/01-github-issue-solver/prompt.md)" --verbose
  ```

### [2. 财经研报聚合流水线](./recipes/02-financial-report-generator/)
- **核心工具**：Brave Search + DAG 工作流
- **场景**：并行调用多个搜索工具获取市场、公司、宏观数据并自动汇总研报。
- **快速体验**：
  ```bash
  npx tsx src/cli/runTask.ts \
    -p "$(cat recipes/02-financial-report-generator/prompt.md)" \
    --workflow recipes/02-financial-report-generator/workflow.yaml \
    --verbose
  ```

更多细节见对应目录内 `README.md` 与 `runtime.yaml`。

## 🧪 开发与测试

### 运行单元测试与集成测试
```bash
npm test
```

### 构建项目
```bash
npm run build
```

## 🗺️ 项目进度

- [x] **Phase 1 (MVP)**: 核心调度、护栏、评估器、工具网关及基础 CLI 实现。
- [x] **Phase 2 (Enhancements)**: 并行编排、自动重试、REPL 模式、事件流增强及 Zod 校验。
- [x] **Phase 3 (Scaling)**: 远程 MCP 服务器支持、状态持久化数据库适配、Web Dashboard。
- [x] **Phase 4-6 (UX & Adoption)**: Quickstart 2.0（preflight）、模板注入、可解释诊断、Adoption 指标导出、Dashboard 体验增强与审计闭环。
- [~] **Phase 7 (Ecosystem & Extensibility)**: 生态扩展能力推进中（与后续阶段并行演进）。
- [~] **Phase 8 (Ultimate DX)**: 开发者体验增强推进中（与后续阶段并行演进）。
- [~] **Phase 9 (Enterprise Ready)**: 企业级能力规划/实现推进中。
- [ ] **Phase 10 (Community & Showcase)**: 即将启动（在执行前将按最新方案落地任务清单）。

## 📄 开源协议

本项目采用 [Apache-2.0](LICENSE) 协议。
