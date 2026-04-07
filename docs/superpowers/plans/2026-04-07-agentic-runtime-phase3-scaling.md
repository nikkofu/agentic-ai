# Phase 3: Scaling & Production Ready Implementation Plan

Phase 3 的核心目标是增强系统的稳定性、持久化能力和多机协同能力，使其能够支撑真实生产环境中的复杂 Agent 任务。

## 🎯 核心目标
1. **持久化与可追溯性**：任务状态从内存转移到数据库，支持任务中断恢复。
2. **远程工具支持**：正式支持远程 MCP (Model Context Protocol) 服务器。
3. **性能优化**：引入任务优先级队列和更精细的并发调度。
4. **可观测性增强**：提供 OpenTelemetry 集成和基于 Web 的监控面板。

---

## 📋 详细任务清单

### Task 1: 任务状态持久化 (Persistence Layer)
- [ ] **1.1 数据库架构设计**：使用 SQLite/PostgreSQL 存储 `TaskGraph` 和 `TaskNode`。
- [ ] **1.2 实现 `SQLTaskStore`**：替换当前的内存存储，确保 `orchestrator` 的状态流转同步至数据库。
- [ ] **1.3 任务恢复机制**：实现 `orchestrator.resume(taskId)`，允许系统重启后继续执行未完成的 `pending` 节点。

### Task 2: 远程 MCP 服务器集成 (Remote Tooling)
- [ ] **2.1 MCP Client 增强**：支持通过 WebSocket/SSE 连接远程 MCP 服务器。
- [ ] **2.2 动态工具发现**：在 `runtime.yaml` 中配置远程 MCP 地址，系统启动时自动协商工具 Schema。
- [ ] **2.3 工具授权流 (OAuth)**：为需要权限的远程工具实现基础的鉴权透传逻辑。

### Task 3: 高级调度与资源管理 (Advanced Scheduling)
- [ ] **3.1 优先级队列**：在 `runParallelTask` 中支持按节点优先级调度。
- [ ] **3.2 令牌限流 (Token Bucket)**：在 `AgentRuntime` 中实现基于 Token 消耗速率的限流，防止触发 LLM 提供商的全局速率限制。
- [ ] **3.3 共享上下文缓存**：在多 Agent 协作时，实现父子节点间公共上下文的智能缓存，减少冗余 Prompt 成本。

### Task 4: 生产级监控与日志 (Production Observability)
- [ ] **4.1 OpenTelemetry 集成**：为关键路径（LLM 调用、工具执行）添加 Trace 追踪。
- [ ] **4.2 结构化 JSON 日志**：将 `EventLogStore` 扩展为支持自动滚动、压缩的生产级日志审计系统。
- [ ] **4.3 成本统计中心**：实时累计每个任务、每个 Agent 角色的 USD 消耗，并在 CLI 结束时给出账单摘要。

### Task 5: 交互性与 UI 增强 (User Interface)
- [ ] **5.1 基础 Web Dashboard**：使用 React/Next.js 开发一个只读面板，可视化展示 `TaskGraph` 的实时流转。
- [ ] **5.2 多模态支持**：扩展 `AgentRuntime` 接口，支持图片、文档等二进制输入负载。
- [ ] **5.3 影子模式运行**：支持将生产流量导向新模型进行“试运行”，并由 `Evaluator` 对比打分而不影响实际业务。

---

## 🛠️ 技术栈建议
- **ORM**: Prisma (配合 PostgreSQL 或 SQLite)
- **Tracing**: OpenTelemetry SDK + Honeycomb/Jaeger
- **UI**: TailwindCSS + Lucide Icons + Mermaid.js (前端渲染)
- **Comm**: MCP TypeScript SDK

---

## 📈 交付标准 (DoD)
1. **任务持久化**：系统进程 kill 后重启，能通过同一 `taskId` 恢复状态。
2. **多机工具**：能成功调用部署在不同容器/机器上的 MCP 服务。
3. **压力测试**：在 `max_parallel: 10` 且伴随大量 429 模拟时，系统能稳定运行 1 小时无崩溃。
4. **文档更新**：更新部署手册，包含数据库配置和监控集成指南。
