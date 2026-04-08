# Phase 3: Task Persistence Layer Design Spec

本项目 Phase 3 的核心任务是引入基于数据库的状态持久化，使 Agent 运行时具备任务中断恢复、历史可追溯及生产级稳定性。

## 1. 目标 (Objectives)
- **任务中断恢复 (Resume)**：系统意外崩溃或重启后，能根据 `taskId` 恢复任务图并继续执行。
- **可观测性增强**：全量持久化事件日志，支持通过外部工具或 UI 分析 Agent 执行路径。
- **解耦设计**：使用仓储模式，确保 Orchestrator 逻辑不与特定数据库实现强耦合。

## 2. 技术选型 (Tech Stack)
- **Database**: SQLite (生产环境建议迁移至 PostgreSQL)
- **ORM**: Prisma
- **Pattern**: Repository Pattern (TaskStore 接口)

## 3. 数据库模型 (Prisma Schema)

```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./runtime.db"
}

generator client {
  provider = "prisma-client-js"
}

// 任务图：存储顶层状态
model TaskGraph {
  task_id      String   @id
  root_node_id String
  status       String   // running, completed, failed, aborted
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt
  nodes        TaskNode[]
  events       RuntimeEvent[]
}

// 任务节点：Agent 树的执行单元
model TaskNode {
  id             Int      @id @default(autoincrement())
  node_id        String   
  task_id        String
  parent_node_id String?
  role           String   
  state          String   // pending, running, waiting_tool, evaluating, completed, failed, aborted
  depth          Int
  attempt        Int
  input_summary  String
  output_summary String?
  
  task           TaskGraph @relation(fields: [task_id], references: [task_id], onDelete: Cascade)

  @@unique([task_id, node_id])
}

// 运行时事件：全量日志
model RuntimeEvent {
  id        Int      @id @default(autoincrement())
  task_id   String
  node_id   String?
  type      String   
  payload   String   // JSON serialized
  ts        BigInt   
  
  task      TaskGraph @relation(fields: [task_id], references: [task_id], onDelete: Cascade)

  @@index([task_id])
  @@index([type])
}
```

## 4. 核心组件与接口

### 4.1 TaskStore 接口
定义在 `src/core/taskStore.ts`：
- `createGraph(taskId, rootNodeId)`
- `upsertNode(taskId, nodeInput)`
- `updateGraphStatus(taskId, status)`
- `appendEvent(event)`
- `getGraph(taskId)`: 获取完整图及节点状态。

### 4.2 事件驱动同步
Orchestrator 将引入一个 `PersistenceManager`：
- 订阅 `EventBus` 的所有事件 (`*`)。
- 当接收到 `NodeScheduled` 时，调用 `taskStore.upsertNode` (状态设为 running)。
- 当接收到 `Evaluated` 时，同步更新节点结果。
- 这种方式确保了业务逻辑 (`orchestrator.ts`) 的纯净度。

## 5. 任务恢复逻辑 (Resume Logic)
`orchestrator.resumeTask(taskId)`：
1. 从 `TaskStore` 加载所有节点。
2. 过滤出 `state` 为 `pending` 或 `running` 的节点。
3. 如果原有的并行任务未完成，根据 `max_parallel` 重新填入调度队列。
4. 恢复后的节点将保留原有的 `depth` 和 `attempt` 计数。

## 6. 测试策略
- **Unit Tests**: 提供 `InMemoryTaskStore` 实现，用于快速验证调度逻辑。
- **Integration Tests**: 使用临时 SQLite 文件测试 Prisma 真实写入与查询性能。
- **Failure Tests**: 在任务执行中途模拟进程退出，重启后验证 `resume` 后的最终状态一致性。

## 7. 命名规范
- 数据库字段与配置文件统一采用 `snake_case` (如 `task_id`, `created_at`)。
- 代码内部属性映射保留 TypeScript 惯用的 `camelCase` (通过 Prisma 的映射机制或手动映射)。
