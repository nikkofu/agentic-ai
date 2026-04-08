# Agentic-AI 全自动图编排系统测试手册 (v0.4.0)

本手册旨在验证 **Autonomous Graph Orchestration (自主图编排)** 核心引擎的功能完整性。

## 🛠 1. 环境准备

1.  **启动 Dashboard**:
    ```bash
    npm run ui:dev
    ```
2.  **环境变量**: 确保根目录 `.env` 文件包含有效 Key：
    ```env
    OPENROUTER_API_KEY=sk-or-v1-...
    ```
3.  **MCP 依赖**: 确保已安装并配置基础 MCP Server（如 filesystem）。

---

## 🧪 2. 核心测试用例

### Case 1: 自主拆解与动态生长 (The "OpenClaw" Story)
**目标**: 验证 Planner 角色能否自主拆解复杂任务，并在 UI 上实时生长出子节点。

*   **输入命令**:
    ```bash
    npx tsx src/cli/runTask.ts -p "深入研究 openclaw 项目，分析创新点，并产出知乎 9.8 分高分文章。请拆解为调研、大纲、正文三个阶段执行。" --verbose
    ```
*   **期待行为**:
    1.  UI 出现 `node-root`。
    2.  `node-root` 返回 JSON，包含 `next_nodes`。
    3.  UI 自动弹出 `node-root-research` 和 `node-root-outline` 节点，并出现**流光连线动画**。
    4.  子节点完成后，最终汇总结果显示在 `📝 Agent Output` 区域。

### Case 2: HITL (人工干预) 与 状态挂起
**目标**: 验证系统在遇到 `hitl` 类型节点时能否正确暂停并等待指令。

*   **输入命令**:
    ```bash
    npx tsx src/cli/runTask.ts -p "策划一场 AI 发布会。在确定方案前，必须通过 hitl 节点请求我审批。" --verbose
    ```
*   **期待行为**:
    1.  UI 生长出一个橙色高亮的 `hitl` 节点。
    2.  终端输出 `[DEBUG] Waiting for Human Action...`。
    3.  Dashboard 显示 `Status: Waiting for HITL`。
    4.  (当前版本) 手动调用 `orchestrator.resumeHitl` (或通过未来 UI 按钮) 唤醒后续流程。

### Case 3: 循环流转 (Autonomous Loop)
**目标**: 验证 Agent 能否自主发起循环，直到满足特定条件。

*   **输入命令**:
    ```bash
    npx tsx src/cli/runTask.ts -p "不断优化一段代码直到其性能提升 50%。使用 loop_entry 节点反复尝试。" --verbose
    ```
*   **期待行为**:
    1.  UI 出现循环路径（节点反复刷新或生成序列节点）。
    2.  `Evaluated` 事件中的 `thought` 记录了每一轮的优化逻辑。

### Case 4: 错误诊断与进程驻留
**目标**: 验证系统在严重错误（如 Key 失效）时，能否为 UI 提供诊断信息并保持存活。

*   **输入命令**:
    ```bash
    # 临时破坏 Key
    export OPENROUTER_API_KEY=invalid && npx tsx src/cli/runTask.ts -p "test error" --verbose
    ```
*   **期待行为**:
    1.  终端显著打印 `❌ RUNTIME ERROR: 401 Unauthorized`。
    2.  输出 `⚠️ Keeping Dashboard alive for 60s...`。
    3.  UI 上 `node-root` 变为红色，或显示错误 Toast 详情。

---

## 📦 3. 交付物归档检查

任务完成后，请检查以下路径：
1.  **事件日志**: `audit_trail.jsonl` 应当记录了所有的 `NodeScheduled` 和 `Evaluated` 原始 payload。
2.  **多模态产出**: 如果 Agent 产出了文件，请检查 `./data` 目录是否已正确同步。

## 📡 4. IM 接入预演方案 (给 Antigravity 的建议)

系统已预留 `WebHub` 接口，IM 机器人可通过以下逻辑接入：
1.  **监听到消息**: 调用 `runTask` 函数。
2.  **订阅事件**: 机器人 Client 订阅 `Evaluated` 事件，实时将 `thought` 推送给用户作为 "Thinking" 进度。
3.  **结果回传**: 监听到 `TaskClosed` 时，将 `outputText` 回传给 IM 用户。
