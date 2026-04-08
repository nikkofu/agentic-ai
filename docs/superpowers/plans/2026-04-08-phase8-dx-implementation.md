# Phase 8: Ultimate Developer Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提供交互式项目脚手架、支持泛用的 OpenAI 兼容接口（以支持本地 LM Studio/vLLM 等零成本沙盒），以及时间旅行调试器底层支持，极大降低新用户的上手与调试成本。

**Architecture:** 引入 `prompts` 实现交互式问答；扩展配置体系支持自定义 OpenAI 兼容接口 (`baseUrl`)；扩展 `TaskStore` 和 `Orchestrator` 提供快照与状态重放接口。

**Tech Stack:** TypeScript, `prompts` (CLI Wizard).

---

### Task 1: 交互式脚手架 (CLI Init Wizard)

**Files:**
- Create: `src/cli/initWizard.ts`
- Modify: `src/cli/runTask.ts`
- Test: `tests/unit/initWizard.test.ts`

- [x] **Step 1: 编写测试断言配置生成逻辑**
验证传入一系列问答答案后，能否生成标准的 `runtime.yaml` 和 `.env` 字符串。

- [x] **Step 2: 实现交互问答逻辑**
在 `src/cli/initWizard.ts` 中使用 `prompts` 库：
- 询问用户：“选择您的 LLM Provider (OpenRouter / 自定义 OpenAI 兼容接口)？”
- 询问用户：“是否开启持久化数据库 (SQLite)？”
- 询问用户：“需要预装哪些能力包/SKILL？(Code Reviewer, None)”

- [x] **Step 3: CLI 接入 `init` 命令**
修改 `src/cli/runTask.ts` 支持 `agentic init`，在项目目录下自动生成基础的 `.env` 和 `config/runtime.yaml`。

- [x] **Step 4: 测试并提交**
```bash
npm test
git add src/cli/initWizard.ts src/cli/runTask.ts tests/unit/initWizard.test.ts
git commit -m "feat: add interactive project scaffolding wizard"
```

---

### Task 2: 泛用 OpenAI 兼容接口支持 (Local Sandbox Ready)

**Files:**
- Modify: `src/model/modelRouter.ts`
- Modify: `src/types/runtime.ts`
- Test: `tests/unit/modelRouter.test.ts`

- [x] **Step 1: 扩展配置 Schema**
在 `runtimeConfigSchema` 中扩展对 provider 的定义，允许在 `runtime.yaml` 中配置自定义的 `base_url` 和 `api_key_env`（例如指向本地的 LM Studio `http://localhost:1234/v1`）。

- [x] **Step 2: 扩展 ModelRouter**
重构 `ModelRouter`，使其不仅返回 `model` 名字，还能根据配置返回对应的 `baseUrl` 和 `apiKey`，并向下透传给统一的 OpenAI 兼容客户端（原 `openrouterClient`）。

- [x] **Step 3: 测试验证与提交**
编写单元测试，验证当配置了本地 OpenAI 兼容服务器时，路由能够正确解析出对应的 `baseUrl`。
```bash
npm test
git add src/model/modelRouter.ts src/types/runtime.ts tests/unit/modelRouter.test.ts
git commit -m "feat: seamlessly support generic OpenAI-compatible endpoints for local sandboxing"
```

---

### Task 3: Time-Travel Debugger (Backend API)

**Files:**
- Modify: `src/core/taskStore.ts`
- Modify: `src/core/prismaTaskStore.ts`
- Modify: `src/core/orchestrator.ts`

- [x] **Step 1: 持久化层支持克隆与分支**
修改 `TaskStore` 接口，增加 `cloneNode(taskId, sourceNodeId, newInputs)`，允许从某个执行失败的节点克隆出一条新的历史分支（类似 Git 树）。

- [x] **Step 2: Orchestrator 支持从特定节点重放 (Replay)**
实现 `orchestrator.replayNode(taskId, nodeId)`，复用 `resumeTask` 逻辑，但强制将选定节点的状态重置为 `pending` 并清空其后续派生的所有子节点。

- [x] **Step 3: 测试并提交**
```bash
npm test
git add src/core/taskStore.ts src/core/prismaTaskStore.ts src/core/orchestrator.ts
git commit -m "feat: add replay and state branching capabilities for time-travel debugging"
```
