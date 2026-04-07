# Phase 3: Task Persistence Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现基于 Prisma + SQLite 的任务状态持久化，支持任务中断恢复 (Resume) 和全量事件日志记录。

**Architecture:** 采用仓储模式 (Repository Pattern)，定义 `TaskStore` 接口。Orchestrator 通过 `PersistenceManager` 监听 `EventBus` 实现透明的状态同步。

**Tech Stack:** Prisma, SQLite, TypeScript, Vitest.

---

### Task 1: 基础设施配置与 Schema 定义

**Files:**
- Create: `prisma/schema.prisma`
- Modify: `package.json`

- [ ] **Step 1: 添加 Prisma 相关依赖**
```bash
npm install prisma @prisma/client
```

- [ ] **Step 2: 初始化 Prisma Schema**
创建 `prisma/schema.prisma`：
```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./runtime.db"
}

generator client {
  provider = "prisma-client-js"
}

model TaskGraph {
  task_id      String   @id
  root_node_id String
  status       String   
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt
  nodes        TaskNode[]
  events       RuntimeEvent[]
}

model TaskNode {
  id             Int      @id @default(autoincrement())
  node_id        String   
  task_id        String
  parent_node_id String?
  role           String   
  state          String   
  depth          Int
  attempt        Int
  input_summary  String
  output_summary String?
  
  task           TaskGraph @relation(fields: [task_id], references: [task_id], onDelete: Cascade)

  @@unique([task_id, node_id])
}

model RuntimeEvent {
  id        Int      @id @default(autoincrement())
  task_id   String
  node_id   String?
  type      String   
  payload   String   
  ts        BigInt   
  
  task      TaskGraph @relation(fields: [task_id], references: [task_id], onDelete: Cascade)

  @@index([task_id])
}
```

- [ ] **Step 3: 生成 Prisma Client 并运行初始迁移**
```bash
npx prisma migrate dev --name init_persistence
```

- [ ] **Step 4: Commit**
```bash
git add prisma/schema.prisma package.json package-lock.json
git commit -m "chore: setup prisma and define persistence schema"
```

---

### Task 2: 定义 TaskStore 接口与内存实现

**Files:**
- Create: `src/core/taskStore.ts`
- Test: `tests/unit/taskStore-memory.test.ts`

- [ ] **Step 1: 定义 TaskStore 接口**
在 `src/core/taskStore.ts` 中写入接口及内存实现类。

- [ ] **Step 2: 编写内存实现的单元测试**
验证 `upsertNode` 和 `appendEvent` 的基本逻辑。

- [ ] **Step 3: 运行测试并通过**
```bash
npx vitest tests/unit/taskStore-memory.test.ts
```

- [ ] **Step 4: Commit**
```bash
git add src/core/taskStore.ts tests/unit/taskStore-memory.test.ts
git commit -m "feat: define TaskStore interface and memory implementation"
```

---

### Task 3: 实现 PrismaTaskStore

**Files:**
- Create: `src/core/prismaTaskStore.ts`
- Test: `tests/integration/prismaTaskStore.test.ts`

- [ ] **Step 1: 实现 PrismaTaskStore 类**
实现接口方法，注意 `payload` 的 JSON 序列化和 `ts` 的 BigInt 处理。

- [ ] **Step 2: 编写集成测试**
使用临时 SQLite 文件进行读写验证。

- [ ] **Step 3: 运行测试并通过**
```bash
npx vitest tests/integration/prismaTaskStore.test.ts
```

- [ ] **Step 4: Commit**
```bash
git add src/core/prismaTaskStore.ts tests/integration/prismaTaskStore.test.ts
git commit -m "feat: implement PrismaTaskStore for SQLite"
```

---

### Task 4: 实现 PersistenceManager (事件同步器)

**Files:**
- Create: `src/core/persistenceManager.ts`
- Modify: `src/core/orchestrator.ts`

- [ ] **Step 1: 创建 PersistenceManager**
订阅 `EventBus` 并将关键事件（NodeScheduled, Evaluated 等）映射为 `TaskStore` 调用。

- [ ] **Step 2: 在 Orchestrator 中注入持久化支持**
修改 `createOrchestrator` 接受 `taskStore` 参数。

- [ ] **Step 3: 验证现有测试不受影响**
```bash
npm test
```

- [ ] **Step 4: Commit**
```bash
git add src/core/persistenceManager.ts src/core/orchestrator.ts
git commit -m "feat: transparent task state synchronization via PersistenceManager"
```

---

### Task 5: 实现任务恢复 (Resume) 逻辑

**Files:**
- Modify: `src/core/orchestrator.ts`
- Test: `tests/integration/orchestrator-resume.test.ts`

- [ ] **Step 1: 在 Orchestrator 中添加 `resumeTask` 方法**
实现从数据库加载未完成节点并重新入队。

- [ ] **Step 2: 编写恢复逻辑测试**
模拟执行中途崩溃，重启后调用 `resumeTask` 验证任务是否继续。

- [ ] **Step 3: 运行测试并通过**
```bash
npx vitest tests/integration/orchestrator-resume.test.ts
```

- [ ] **Step 4: Commit**
```bash
git add src/core/orchestrator.ts tests/integration/orchestrator-resume.test.ts
git commit -m "feat: implement task resume capability"
```

---

### Task 6: 最终集成与冒烟测试

**Files:**
- Modify: `src/cli/runTask.ts`

- [ ] **Step 1: 在 CLI 中启用持久化**
默认使用 `PrismaTaskStore`。

- [ ] **Step 2: 运行冒烟测试并检查 runtime.db**
```bash
npx tsx src/cli/runTask.ts -p "persistence test"
```

- [ ] **Step 3: Commit**
```bash
git add src/cli/runTask.ts
git commit -m "feat: enable persistence by default in CLI"
```
