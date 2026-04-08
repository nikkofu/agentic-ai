# Phase 10: Community & Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建设高质量的用例画廊、交互式文档和 ChatOps 集成（Slack & WhatsApp），极大降低社区用户的认知门槛并激发口碑裂变。

**Architecture:** Nextra 文档站点建设；建立独立的 `recipes` 目录维护官方使用案例；封装 Slack 与 WhatsApp 消息机器人实现多端通知。

**Tech Stack:** Nextra (Docs), Slack API, Baileys (WhatsApp).

---

### Task 1: 官方用例画廊 (Use Case Gallery) (Done)
- [x] **Step 1: 编写 GitHub Issue 解决器配方**
- [x] **Step 2: 编写财经研报聚合流水线配方**
- [x] **Step 3: Commit**

---

### Task 2: 交互式文档站点 (Interactive Docs) (Done)
- [x] **Step 1: 初始化 Nextra 项目**
- [x] **Step 2: 迁移与组织现有文档**
- [x] **Step 3: 部署与 Commit**

---

### Task 3: ChatOps 集成 (Slack Bot) (Done)
- [x] **Step 1: 安装 Slack 依赖**
- [x] **Step 2: 编写 SlackBot 包装器**
- [x] **Step 3: CLI 集成**
- [x] **Step 4: 测试并提交**

---

### Task 4: WhatsApp 集成 (Baileys)

**Files:**
- Create: `src/bots/whatsappBot.ts`
- Modify: `src/cli/runTask.ts`
- Modify: `package.json`

- [ ] **Step 1: 安装 Baileys 及其依赖**
```bash
npm install @whiskeysockets/baileys qrcode-terminal pino
```

- [ ] **Step 2: 实现 WhatsAppBot 包装器**
在 `src/bots/whatsappBot.ts` 中使用 `Baileys`：
- 实现 QR 码终端展示以进行登录。
- 监听 `EventBus`：
  - `TaskSubmitted` -> 发送任务开始消息。
  - `TaskClosed` -> 发送任务完成报告（含状态、消耗统计）。
- (可选) 支持通过消息直接触发任务。

- [ ] **Step 3: CLI 集成**
支持 `--notify whatsapp` 参数。
- 从环境变量 `WHATSAPP_RECIPIENT` 获取接收消息的号码/群组 ID。

- [ ] **Step 4: 测试与提交**
```bash
npm test
git add src/bots/whatsappBot.ts src/cli/runTask.ts package.json
git commit -m "feat: integrate WhatsApp bot for ChatOps via Baileys"
```
