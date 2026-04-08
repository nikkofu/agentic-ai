# Phase 3: Multi-MCP Server Integration Design Spec

本项目 Phase 3 的核心任务是引入真实的 Model Context Protocol (MCP) 支持，允许 Agent 通过 Stdio 传输协议连接并调用外部工具服务器。

## 1. 目标 (Objectives)
- **多服务器支持**：支持同时连接多个独立的 MCP Server（如 Filesystem, Brave Search）。
- **标准协议接入**：引入官方 `@modelcontextprotocol/sdk`，实现完整的 JSON-RPC 通信。
- **生命周期管理**：自动启动 Server 进程，并在任务结束或崩溃时确保进程被正确回收。
- **工具隔离与路由**：通过 `server_name/tool_name` 命名空间防止工具冲突。

## 2. 核心架构：McpHub
`McpHub` 是管理所有 MCP 连接的中心枢纽，其主要职责包括：
- **初始化**：从 `RuntimeConfig` 读取 `mcp_servers` 列表并建立 Stdio 连接。
- **工具映射**：维护一个全局工具表，将 `server/tool` 路由到正确的 Client 实例。
- **健康检查**：监控子进程状态，处理断线重连或异常退出。

## 3. 接口变更

### 3.1 配置文件 (`config/runtime.yaml`)
新增 `mcp_servers` 块：
```yaml
mcp_servers:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "./data"]
  google_search:
    command: "python3"
    args: ["search_server.py"]
    env:
      API_KEY: "..."
```

### 3.2 McpClient (重构)
`src/tools/mcpClient.ts` 将从简单的 Mock 演进为包装官方 SDK 的 `McpClientInstance`。

### 3.3 ToolGateway (适配)
`ToolGateway` 在处理 `transport: "mcp"` 时，将调用 `McpHub.callTool(name, args)`。

## 4. 详细流程 (Data Flow)
1. **启动**：`runTask.ts` 初始化 `PrismaClient` 之后，初始化 `McpHub`。
2. **协商**：`McpHub` 为每个配置的 Server 创建 `StdioClientTransport`，完成 `initialize` 握手。
3. **调用**：
   - Agent 发出工具请求：`transport: mcp, tool: "filesystem/read_file"`。
   - `ToolGateway` 转发给 `McpHub`。
   - `McpHub` 找到名为 `filesystem` 的 Client 实例，执行 JSON-RPC 调用。
   - 结果经过格式化回传给 Agent。
4. **清理**：任务完成（`TaskClosed`）后，`McpHub.closeAll()` 关闭所有子进程。

## 5. 错误处理 (Error Handling)
- **SERVER_START_FAILED**：命令不存在或权限不足。
- **CALL_TIMEOUT**：工具执行超过预设阈值（默认 30s）。
- **PROCESS_EXITED**：子进程意外崩溃。
- **SCHEMA_MISMATCH**：参数校验未通过官方 SDK 的 Zod 检查。

## 6. 测试策略
- **Mock Tests**：编写模拟 Stdio 流量的测试，验证 `McpHub` 的路由逻辑。
- **Local Integration**：使用 `@modelcontextprotocol/server-filesystem` 进行真实的本地文件读写验证。
- **Cleanup Tests**：确保即使任务崩溃，子进程也不会变成僵尸进程。
