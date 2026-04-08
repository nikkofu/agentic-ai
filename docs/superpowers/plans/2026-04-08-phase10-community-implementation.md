# Phase 10: Community & Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建设高质量的用例画廊、交互式文档和 ChatOps 集成，极大降低社区用户的认知门槛并激发口碑裂变。

**Architecture:** Nextra 文档站点建设；建立独立的 `recipes` 目录维护官方使用案例；利用 `@slack/web-api` 封装群组消息通知机器人。

**Tech Stack:** Nextra (Docs), Slack API.

---

### Task 1: 官方用例画廊 (Use Case Gallery)

**Files:**
- Create: `recipes/01-github-issue-solver/`
- Create: `recipes/02-financial-report-generator/`
- Modify: `README.md`

- [ ] **Step 1: 编写 GitHub Issue 解决器配方**
在 `recipes/01-github-issue-solver/` 下提供完整的 `runtime.yaml`、必要的提示词以及 README，演示如何结合 `mcp-github` 和 `mcp-filesystem` 实现自动修复 Bug。

- [ ] **Step 2: 编写财经研报聚合流水线配方**
在 `recipes/02-financial-report-generator/` 下演示利用 DAG 工作流，并发调用 Brave Search 获取数据并由 Writer Agent 汇总排版的案例。

- [ ] **Step 3: Commit**
```bash
git add recipes/ README.md
git commit -m "docs: establish official use case gallery with end-to-end recipes"
```

---

### Task 2: 交互式文档站点 (Interactive Docs)

**Files:**
- Create: `docs-site/` (Nextra Scaffolding)

- [ ] **Step 1: 初始化 Nextra 项目**
在根目录下运行 `npx create-next-app docs-site --example nextra-docs`（或相应的模板命令），并清理无用文件。

- [ ] **Step 2: 迁移与组织现有文档**
将 `docs/superpowers/specs/` 中沉淀的核心设计理念和架构图转化为适合最终用户阅读的文档章节（如 Getting Started, Architecture, MCP Integration）。

- [ ] **Step 3: 部署与 Commit**
```bash
git add docs-site/
git commit -m "chore: scaffold Nextra documentation site"
```

---

### Task 3: ChatOps 集成 (Slack Bot)

**Files:**
- Create: `src/bots/slackBot.ts`
- Modify: `src/cli/runTask.ts`

- [ ] **Step 1: 安装 Slack 依赖**
```bash
npm install @slack/web-api
```

- [ ] **Step 2: 编写 SlackBot 包装器**
在 `src/bots/slackBot.ts` 中实现监听 EventBus 的机制，当 `TaskSubmitted` 时发送一条初始消息，并在 `TaskClosed` 时使用富文本卡片 (Block Kit) 更新该消息，展示成功率、总耗时和费用。

- [ ] **Step 3: CLI 集成**
支持 `--notify slack` 参数，在启动任务时挂载 SlackBot 中间件。

- [ ] **Step 4: 测试并提交**
```bash
npm test
git add src/bots/slackBot.ts src/cli/runTask.ts package.json
git commit -m "feat: integrate Slack bot for ChatOps task notifications"
```
