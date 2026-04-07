# Multi-MCP Server Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 `McpHub` 组件，支持通过 Stdio 协议并发连接多个 MCP 服务器，并为 Agent 提供统一的工具调用入口。

**Architecture:** `McpHub` 管理多个官方 MCP SDK `Client` 实例。`ToolGateway` 负责将调用路由到对应的服务器。

**Tech Stack:** @modelcontextprotocol/sdk, TypeScript, Vitest.

---

### Task 1: 基础设施与配置定义

**Files:**
- Modify: `src/types/runtime.ts`
- Modify: `config/runtime.yaml`
- Modify: `package.json`

- [ ] **Step 1: 安装官方 MCP SDK**
```bash
npm install @modelcontextprotocol/sdk
```

- [ ] **Step 2: 更新 RuntimeConfig Schema**
在 `src/types/runtime.ts` 中增加 `mcp_servers` 字段定义。
```typescript
mcp_servers: z.record(z.string(), z.object({
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional()
})).default({})
```

- [ ] **Step 3: 更新默认配置文件**
在 `config/runtime.yaml` 中添加示例 MCP 配置（如 filesystem）。

- [ ] **Step 4: Commit**
```bash
git add src/types/runtime.ts config/runtime.yaml package.json package-lock.json
git commit -m "chore: define mcp_servers configuration schema"
```

---

### Task 2: 实现 McpHub 生命周期管理

**Files:**
- Create: `src/tools/mcpHub.ts`
- Test: `tests/unit/mcpHub.test.ts`

- [ ] **Step 1: 编写 McpHub 骨架**
实现 `initialize(configs)` 和 `closeAll()`。使用 `StdioClientTransport` 连接服务器。

- [ ] **Step 2: 实现工具发现与调用路由**
实现 `callTool(fullName, args)`，支持通过 `"server/tool"` 格式解析路由。

- [ ] **Step 3: 编写 Mock 测试**
模拟 `StdioClientTransport` 验证 `McpHub` 是否能正确分发请求到不同的 Client。

- [ ] **Step 4: Commit**
```bash
git add src/tools/mcpHub.ts tests/unit/mcpHub.test.ts
git commit -m "feat: implement McpHub for managing multiple mcp connections"
```

---

### Task 3: 重构 ToolGateway 集成 McpHub

**Files:**
- Modify: `src/tools/toolGateway.ts`
- Test: `tests/unit/toolGateway-mcp.test.ts`

- [ ] **Step 1: 修改 ToolGateway 依赖**
将 `McpClient` 替换为 `McpHub`。

- [ ] **Step 2: 适配调用逻辑**
在 `invoke` 方法中，如果是 `transport: "mcp"`，则调用 `mcpHub.callTool`。

- [ ] **Step 3: 更新测试**
更新原有的工具网关测试，确保路由逻辑正确。

- [ ] **Step 4: Commit**
```bash
git add src/tools/toolGateway.ts tests/unit/toolGateway-mcp.test.ts
git commit -m "refactor: integrate McpHub into ToolGateway"
```

---

### Task 4: CLI 全链路集成与清理

**Files:**
- Modify: `src/cli/runTask.ts`

- [ ] **Step 1: 在 CLI 启动时初始化 McpHub**
从 `config` 读取 `mcp_servers` 并调用 `hub.initialize()`。

- [ ] **Step 2: 在 CLI 结束时关闭 McpHub**
在 `finally` 块中调用 `hub.closeAll()` 以回收子进程。

- [ ] **Step 3: 本地集成测试 (Filesystem)**
配置一个真实的 `server-filesystem` MCP 服务器，运行一次任务并验证文件读取。

- [ ] **Step 4: Commit**
```bash
git add src/cli/runTask.ts
git commit -m "feat: enable multi-mcp support in CLI"
```

---

### Task 5: 最终回归与文档更新

- [ ] **Step 1: 运行全量回归测试**
```bash
npm test
```

- [ ] **Step 2: 更新 README.md**
添加关于如何配置和使用多个 MCP 服务器的说明。

- [ ] **Step 3: Commit**
```bash
git add README.md
git commit -m "docs: document multi-mcp server configuration"
```
