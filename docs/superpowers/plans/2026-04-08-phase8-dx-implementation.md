# Phase 8: Ultimate Developer Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提供零成本本地沙盒、交互式项目脚手架以及时间旅行调试器底层支持，极大降低新用户的上手与调试成本。

**Architecture:** 引入 `prompts` 实现交互式问答；扩展 `ModelRouter` 原生支持 Ollama 本地模型寻址；扩展 `TaskStore` 和 `Orchestrator` 提供快照与状态重放接口。

**Tech Stack:** TypeScript, `prompts` (CLI Wizard).

---

### Task 1: 交互式脚手架 (CLI Init Wizard)

**Files:**
- Create: `src/cli/initWizard.ts`
- Modify: `src/cli/runTask.ts`
- Test: `tests/unit/initWizard.test.ts`

- [ ] **Step 1: 编写测试断言配置生成逻辑**
验证传入一系列问答答案后，能否生成标准的 `runtime.yaml` 和 `.env` 字符串。

- [ ] **Step 2: 实现交互问答逻辑**
在 `src/cli/initWizard.ts` 中使用 `prompts` 库：
- 询问用户：“是否配置 OpenRouter 还是使用 Local Sandbox (Ollama)？”
- 询问用户：“是否开启持久化数据库？”
- 询问用户：“需要预装哪些 MCP 工具？(Filesystem, GitHub, None)”

- [ ] **Step 3: CLI 接入 `init` 命令**
修改 `src/cli/runTask.ts` 支持 `agentic init`，在项目目录下生成脚手架文件。

- [ ] **Step 4: 测试并提交**
```bash
npm test
git add src/cli/initWizard.ts src/cli/runTask.ts tests/unit/initWizard.test.ts
git commit -m "feat: add interactive project scaffolding wizard"
```

---

### Task 2: 本地零成本沙盒 (Ollama 深度集成)

**Files:**
- Modify: `src/model/modelRouter.ts`
- Create: `src/model/ollamaClient.ts`
- Test: `tests/unit/ollamaClient.test.ts`

- [ ] **Step 1: 实现 Ollama Client**
支持标准的 `/api/generate` 或 `/v1/chat/completions` 本地调用，并实现流式解析。

- [ ] **Step 2: 扩展 ModelRouter 支持本地标识**
如果模型名称是以 `ollama/` 开头（如 `ollama/qwen:4b`），则绕过 `OpenRouter` API Key 检查，将其路由至本地的 `http://localhost:11434`。

- [ ] **Step 3: 测试验证与提交**
编写单元测试模拟 Ollama 本地 API 响应，确保不需要凭证也能成功 `runNode`。
```bash
npm test
git add src/model/modelRouter.ts src/model/ollamaClient.ts tests/unit/ollamaClient.test.ts
git commit -m "feat: seamlessly integrate local sandbox via Ollama"
```

---

### Task 3: Time-Travel Debugger (Backend API)

**Files:**
- Modify: `src/core/taskStore.ts`
- Modify: `src/core/prismaTaskStore.ts`
- Modify: `src/core/orchestrator.ts`

- [ ] **Step 1: 持久化层支持克隆与分支**
修改 `TaskStore` 接口，增加 `cloneNode(taskId, sourceNodeId, newInputs)`，允许从某个执行失败的节点克隆出一条新的历史分支（类似 Git 树）。

- [ ] **Step 2: Orchestrator 支持从特定节点重放 (Replay)**
实现 `orchestrator.replayNode(taskId, nodeId)`，复用 `resumeTask` 逻辑，但强制将选定节点的状态重置为 `pending` 并清空其后续派生的所有子节点。

- [ ] **Step 3: 测试并提交**
```bash
npm test
git add src/core/taskStore.ts src/core/prismaTaskStore.ts src/core/orchestrator.ts
git commit -m "feat: add replay and state branching capabilities for time-travel debugging"
```
