# Phase 3: Visual Dashboard (Web UI) Design Spec

本项目 Phase 3 的可视化任务旨在提供一个交互式的 Web 界面，通过 WebSocket 实时反映 Agent 运行时的任务图流转、事件流和财务成本。

## 1. 目标 (Objectives)
- **实时任务图可视化**：使用 React Flow 展示复杂的递归 Agent 调用树。
- **毫秒级同步**：通过 WebSocket 直接透传 EventBus 事件，实现零延迟状态更新。
- **详尽详情下钻**：点击节点可查看 Prompt、Raw LLM Output、Trace 和成本细节。
- **全栈体验**：集成 Next.js 和 Tailwind，提供现代化的生产级监控面板。

## 2. 技术栈 (Tech Stack)
- **Frontend**: Next.js (App Router), TailwindCSS, Lucide Icons.
- **Graph Engine**: React Flow + Dagre (用于自动布局)。
- **Real-time**: `ws` (Node.js) + Browser WebSocket API.
- **Data Source**: SQLite (历史记录) + WebSocket (实时流)。

## 3. 核心组件设计

### 3.1 CLI 侧：WebHub (`src/core/webHub.ts`)
一个轻量级的 WebSocket 服务端，注入到 CLI 运行时中。
- **功能**：
  - 启动端口（默认 3001）。
  - 订阅 `EventBus` 的所有事件 (`*`)。
  - 将事件 JSON 化并通过 WebSocket 广播给前端。
  - CLI 退出时自动关闭 Server。

### 3.2 Web 侧：Event Receiver
前端的状态管理中心。
- **功能**：
  - 建立 WebSocket 连接。
  - 将接收到的 `NodeScheduled`, `Evaluated` 等事件转换为 React Flow 的 `Nodes` 和 `Edges` 变更。
  - 自动触发布局计算（Dagre）。

### 3.3 UI 布局
- **Canvas (React Flow)**：中心展示动态增长的任务树。
- **Sidebar (Metrics)**：顶部或侧边展示实时 `Total Cost` 和 `Token Usage`。
- **Inspector (Right Pane)**：节点详情查看器。

## 4. 详细流程 (Data Flow)
1. **启动**：用户执行 `runTask.ts`，控制台打印：`Dashboard: http://localhost:3000?taskId=...`。
2. **连接**：用户打开浏览器，前端向 CLI 的 WebHub 发起 WebSocket 握手。
3. **透传**：`Orchestrator` 执行 `runNode` -> `EventBus.publish` -> `WebHub` 捕获并推送到 WebSocket。
4. **渲染**：前端 React Flow 瞬间新增一个节点，并连接到父节点。
5. **持久化同步**：点击历史任务时，前端直接从 `prisma` (Next.js Server Side) 读取 SQLite 数据进行静态回放。

## 5. 交互功能
- **缩放/平移**：自由探索超大规模的递归树。
- **节点筛选**：仅查看特定状态（如 Failed）或特定角色（如 Researcher）的节点。
- **状态快照**：支持将当前任务图导出为图片或 Mermaid 文本。

## 6. 测试策略
- **WebHub Connectivity Test**：验证 WebSocket 消息能否正确编码和广播。
- **UI Store Test**：测试 Redux/Zustand 状态机能否正确处理乱序或高频的事件流。
- **Layout Stress Test**：验证在深度为 10、节点数为 100+ 的极端树结构下，Dagre 布局的性能表现。
