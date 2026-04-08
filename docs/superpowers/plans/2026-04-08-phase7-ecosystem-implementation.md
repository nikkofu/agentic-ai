# Phase 7: Ecosystem & Extensibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建插件扩展能力和 MCP 社区包管理器，打破系统封闭性，同时支持声明式 DAG 工作流引擎以应对复杂的依赖流转。

**Architecture:** 引入 `MiddlewareManager` 实现洋葱模型的拦截器；实现基于 `git` 和 `npm` 的 MCP 动态拉取注册表；新增 `DagEngine` 来解析并转化为底层的并行与顺序节点调度。

**Tech Stack:** TypeScript, Zod, Node.js `child_process`.

---

### Task 1: 核心中间件架构 (Middleware API)

**Files:**
- Create: `src/core/middleware.ts`
- Modify: `src/core/orchestrator.ts`
- Test: `tests/unit/middleware.test.ts`

- [ ] **Step 1: 编写失败的中间件测试**
```typescript
import { describe, it, expect, vi } from "vitest";
import { MiddlewareManager } from "../../src/core/middleware";

describe("MiddlewareManager", () => {
  it("executes middlewares in onion model order", async () => {
    const manager = new MiddlewareManager();
    const calls: string[] = [];
    
    manager.use(async (ctx, next) => {
      calls.push("m1-pre");
      await next();
      calls.push("m1-post");
    });
    
    manager.use(async (ctx, next) => {
      calls.push("m2-pre");
      await next();
      calls.push("m2-post");
    });

    await manager.execute({ data: "init" }, async () => {
      calls.push("core");
    });

    expect(calls).toEqual(["m1-pre", "m2-pre", "core", "m2-post", "m1-post"]);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**
Run: `npx vitest run tests/unit/middleware.test.ts`
Expected: FAIL (MiddlewareManager not defined)

- [ ] **Step 3: 最小实现中间件管理器**
在 `src/core/middleware.ts` 中实现：
```typescript
export type Middleware<T> = (ctx: T, next: () => Promise<void>) => Promise<void>;

export class MiddlewareManager<T> {
  private middlewares: Middleware<T>[] = [];

  use(middleware: Middleware<T>) {
    this.middlewares.push(middleware);
  }

  async execute(context: T, coreFn: () => Promise<void>): Promise<void> {
    let index = -1;
    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) throw new Error("next() called multiple times");
      index = i;
      if (i === this.middlewares.length) {
        await coreFn();
        return;
      }
      const middleware = this.middlewares[i];
      await middleware(context, dispatch.bind(null, i + 1));
    };
    await dispatch(0);
  }
}
```

- [ ] **Step 4: 将 Middleware 注入 Orchestrator**
在 `src/core/orchestrator.ts` 中实例化 `nodeMiddleware`，允许外部通过 `orchestrator.use()` 挂载拦截器，在 `runNode` 执行前后触发。

- [ ] **Step 5: 运行测试并提交**
```bash
npm test
git add src/core/middleware.ts src/core/orchestrator.ts tests/unit/middleware.test.ts
git commit -m "feat: add onion-model middleware architecture for node execution"
```

---

### Task 2: MCP 社区包管理器 (`mcp-registry`)

**Files:**
- Create: `src/cli/mcpRegistry.ts`
- Modify: `src/cli/runTask.ts`
- Test: `tests/unit/mcpRegistry.test.ts`

- [ ] **Step 1: 编写失败的 Registry 测试**
验证 `installMcpPackage` 函数能否正确解析 GitHub 仓库地址，并生成预期的 `mcp_servers` 配置片段。

- [ ] **Step 2: 实现 MCP 注册逻辑**
在 `src/cli/mcpRegistry.ts` 中：
```typescript
import { execSync } from "child_process";
import fs from "fs";

export function installMcpPackage(repoUrl: string, configPath: string) {
  // 1. Git clone repo to ~/.config/superpowers/mcp_packages/
  // 2. npm install inside the repo
  // 3. Read mcp.json from the repo to get command/args
  // 4. Update the local runtime.yaml with the new server config
}
```

- [ ] **Step 3: CLI 接入**
修改 `src/cli/runTask.ts`，支持新的子命令：
如果参数是 `mcp install <repo>`，则调用 `installMcpPackage` 并退出。

- [ ] **Step 4: 测试并提交**
```bash
npm test
git add src/cli/mcpRegistry.ts src/cli/runTask.ts tests/unit/mcpRegistry.test.ts
git commit -m "feat: implement basic MCP package manager for community extensions"
```

---

### Task 3: 声明式 DAG 工作流引擎 (DagEngine)

**Files:**
- Create: `src/core/dagEngine.ts`
- Create: `src/types/dag.ts`
- Test: `tests/unit/dagEngine.test.ts`

- [ ] **Step 1: 定义 DAG 类型与验证 Schema**
在 `src/types/dag.ts` 中定义 `DagWorkflow` 类型，包含节点列表及其 `depends_on` 依赖关系。

- [ ] **Step 2: 编写失败的拓扑排序测试**
```typescript
it("sorts nodes topologically and detects circular dependencies", () => {
  // Define nodes A, B (depends on A), C (depends on A), D (depends on B, C)
  // Expect output to be tiered arrays: [[A], [B, C], [D]]
});
```

- [ ] **Step 3: 实现 DagEngine 拓扑算法**
在 `src/core/dagEngine.ts` 中实现 `resolveExecutionTiers(workflow)`，将 DAG 转换为可以被 `runParallelTask` 分批次按顺序调用的层级结构。

- [ ] **Step 4: 运行测试并提交**
```bash
npm test
git add src/core/dagEngine.ts src/types/dag.ts tests/unit/dagEngine.test.ts
git commit -m "feat: add DAG workflow engine for complex dependency resolution"
```

---

### Task 4: CLI 运行 DAG 工作流集成

**Files:**
- Modify: `src/cli/runTask.ts`
- Test: `tests/integration/dag-orchestrator.test.ts`

- [ ] **Step 1: 编写集成测试**
模拟传入一个包含 3 个节点的 DAG 配置文件，验证 `Orchestrator` 是否能按依赖层级依次触发 `runParallelTask`。

- [ ] **Step 2: CLI 接入 DAG 启动参数**
修改 `parseRunTaskArgs` 和主逻辑，支持 `--workflow <file.yaml>`。解析后送入 `DagEngine`，然后循环驱动 `Orchestrator`。

- [ ] **Step 3: 测试并提交**
```bash
npm test
git add src/cli/runTask.ts tests/integration/dag-orchestrator.test.ts
git commit -m "feat: integrate DAG workflow engine into CLI runner"
```
