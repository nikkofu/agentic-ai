# Visual Dashboard (Web UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 实现一个实时的 Web Dashboard，通过 WebSocket 展现 CLI 运行时的 Agent 任务图流转。

**Architecture:** CLI 侧集成 `WebHub` (WebSocket Server)，UI 侧使用 Next.js + React Flow 进行渲染。

**Tech Stack:** Next.js (App Router), TailwindCSS, React Flow, `ws` (WebSocket), Dagre.

---

### Task 1: CLI 侧 WebSocket 基础设施

**Files:**
- Create: `src/core/webHub.ts`
- Modify: `package.json`
- Modify: `src/cli/runTask.ts`

- [x] **Step 1: 安装 ws 依赖**
```bash
npm install ws && npm install --save-dev @types/ws
```

- [x] **Step 2: 实现 WebHub**
在 `src/core/webHub.ts` 中实现一个简单的 WebSocket Server，支持订阅 `EventBus` 并广播 JSON 序列化后的事件。

- [x] **Step 3: 集成到 CLI**
在 `src/cli/runTask.ts` 的 `runTask` 函数中：
  - 启动 `WebHub`（默认端口 3001）。
  - 在 `finally` 块中关闭 `WebHub`。
  - 启动时打印控制台提示：`Real-time Dashboard: http://localhost:3000?taskId=...`

- [x] **Step 4: Commit**
```bash
git add src/core/webHub.ts src/cli/runTask.ts package.json
git commit -m "feat: implement WebHub WebSocket server for real-time telemetry"
```

---

### Task 2: UI 项目脚手架与初始化

**Files:**
- Create: `ui/` (Directory)

- [x] **Step 1: 初始化 Next.js 项目**
在根目录下运行（使用默认推荐配置）：
```bash
npx create-next-app@latest ui --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
```

- [x] **Step 2: 安装可视化依赖**
```bash
cd ui && npm install reactflow @dagrejs/dagre lucide-react
```

- [x] **Step 3: 配置根项目脚本**
在根目录 `package.json` 中添加：`"ui:dev": "cd ui && npm run dev"`。

- [x] **Step 4: Commit**
```bash
git add ui/ package.json
git commit -m "chore: scaffold Next.js dashboard project"
```

---

### Task 3: 实现实时事件接收与状态管理

**Files:**
- Create: `ui/hooks/useEventStream.ts`
- Create: `ui/store/useTaskStore.ts` (使用 Zustand 或简单 React Context)

- [x] **Step 1: 编写 WebSocket Hook**
实现 `useEventStream(taskId)`，处理连接建立、重连和消息解析。

- [x] **Step 2: 实现任务图状态机**
将接收到的 `NodeScheduled`, `AgentStarted`, `Evaluated` 等事件转换为 React Flow 的 `Nodes` 和 `Edges` 数据结构。使用 Dagre 进行增量布局计算。

- [x] **Step 3: Commit**
```bash
git add ui/hooks/ ui/store/
git commit -m "feat: implement client-side event processing and flow state management"
```

---

### Task 4: 构建 Dashboard 核心界面

**Files:**
- Create: `ui/app/dashboard/page.tsx`
- Create: `ui/components/GraphCanvas.tsx`
- Create: `ui/components/NodeInspector.tsx`

- [x] **Step 1: 实现 React Flow 画布**
渲染 Task 3 准备好的节点和连线。为不同 Role 的 Agent 定制 Node 样式。

- [x] **Step 2: 实现详情侧边栏**
点击 Node 时显示侧边栏，通过过滤本地状态展示该节点的 `inputSummary`, `outputSummary` 和 `llmUsage`。

- [x] **Step 3: 实现全局 Metrics 栏**
顶部展示总耗时、累计 Token 和总成本（从事件流中聚合）。

- [x] **Step 4: Commit**
```bash
git add ui/app/ ui/components/
git commit -m "feat: build dashboard UI with React Flow and Tailwind"
```

---

### Task 5: 最终验证与 E2E 冒烟测试

- [x] **Step 1: 启动全链路测试**
  - 启动 UI：`npm run ui:dev`
  - 启动 CLI：`npx tsx src/cli/runTask.ts -p "visual test"`
  - 观察浏览器中是否实时生成并排布节点。

- [x] **Step 2: 文档更新**
更新 `README.md`，添加 Dashboard 启动说明。

- [x] **Step 3: Commit**
```bash
git add README.md
git commit -m "docs: add dashboard usage instructions"
```
