# Agentic Runtime 增强能力设计（Phase 1+2）

- 日期：2026-04-07
- 基础版本：MVP runtime kernel（已上线）
- 目标：按两阶段增强系统的可观测性、健壮性、交互性与并行能力

## 1. 目标与范围

本设计覆盖以下 6 项增强能力，并按阶段分批交付：

### Phase 1（稳定层）
1. EventBus 支持事件过滤订阅（精确类型 + 前缀通配）
2. EventLogStore 增加 JSONL 持久化
3. CLI 增加 `--verbose` 实时事件流输出
4. 事件发布时 Zod 强校验

### Phase 2（增强层）
1. AgentRuntime 指数退避重试
2. ModelFallback 自动降级切换
3. CLI REPL 连续交互与 revise 审批
4. Orchestrator 受控并行 + join 汇总

## 2. 非目标

1. 不在本阶段引入分布式多节点调度
2. 不在本阶段引入数据库级事件存储（SQLite 可作为下一阶段）
3. 不在本阶段实现多用户会话 REPL

## 3. 总体架构增量

在现有模块基础上新增/扩展：

- `src/core/eventSchemas.ts`：事件 schema 注册中心
- `src/core/eventBus.ts`：支持 pattern 订阅与 unsubscribe
- `src/core/eventLogStore.ts`：新增 `JsonlEventLogStore`
- `src/cli/runTask.ts`：支持 `--verbose` / `--repl`
- `src/agents/agentRuntime.ts`：重试与 fallback 逻辑
- `src/core/orchestrator.ts`：并行执行与 join 汇总

## 4. Phase 1 设计

### 4.1 EventBus 过滤订阅

目标接口：

- `subscribe(eventPattern, callback): unsubscribe`
- `eventPattern` 支持：
  - 精确匹配：`TaskSubmitted`
  - 前缀通配：`Task.*`

匹配规则：

1. 无 `*` 时做精确匹配
2. `X.*` 匹配 `X.` 前缀的所有事件
3. 发布时仅分发给匹配订阅者

### 4.2 事件 Zod 强校验

在 publish 流程内执行：

1. 查找 `EventSchemaRegistry[event.type]`
2. 校验 payload
3. 校验失败直接抛错并拒绝发布

最小 schema 覆盖：

- TaskSubmitted
- NodeScheduled
- AgentStarted
- PromptComposed
- ModelCalled
- ToolInvoked
- ToolReturned
- Evaluated
- NodeCompleted
- TaskClosed
- GuardrailTripped

### 4.3 JSONL 持久化

新增实现：`JsonlEventLogStore`

行为：

1. 每个事件追加一行 JSON
2. 默认文件路径：`./runtime-events.jsonl`（可配置）
3. 保留 `InMemoryEventLogStore` 用于单元测试

数据字段最小集合：

- `ts`
- `type`
- `payload`
- `task_id`（从 payload 中抽取/补齐）

### 4.4 `--verbose` 实时事件流

在 CLI 运行时：

1. 订阅 `*` 或关键事件集合
2. 实时打印：`[time] event_type key_fields`
3. 结束后仍输出最终 JSON 摘要（兼容自动化）

## 5. Phase 2 设计

### 5.1 重试机制

触发条件：

- HTTP 429
- HTTP 5xx
- timeout / 网络瞬态故障

不触发重试：

- 非 429 的 4xx（参数错误、权限错误）

策略：

- `delay = base_delay * 2^attempt + jitter`
- `max_retries` 可配置

### 5.2 ModelFallback

当主模型重试耗尽后：

1. 切换到 fallback 列表中的下一个模型
2. 继续执行同一任务节点
3. 记录 fallback 事件（用于可观测性与成本分析）

配置建议：

```yaml
models:
  default: "primary/model"
  fallback:
    - "secondary/model"
    - "tertiary/model"
```

### 5.3 REPL 交互模式

新增 `--repl`：

- 普通文本：提交新任务
- `/approve`：批准 evaluator 的 revise 建议
- `/reject`：拒绝 revise（终止或回退）
- `/exit`：结束会话

### 5.4 受控并行 + join

新增配置：

```yaml
scheduler:
  max_parallel: 3
```

执行策略：

1. frontier 取最多 N 个节点并发执行
2. 完成后进入 join 汇总
3. evaluator 对汇总结果给出最终决策

## 6. 错误处理与护栏

1. 任一分支触发硬熔断，可配置行为：
   - 全局降级串行
   - 任务终止
2. 并行执行仍受预算/步数/深度/分支限制
3. JSONL 写入失败时：
   - 默认中止任务（保证可审计）
   - 可选降级仅内存（由配置控制）

## 7. 测试策略

### Phase 1 必测
1. EventBus 精确/通配订阅匹配
2. unsubscribe 行为
3. 非法 payload 发布失败
4. JSONL 文件写入与可读回放
5. `--verbose` 输出包含关键事件

### Phase 2 必测
1. 429/5xx/timeout 重试次数与退避
2. 4xx 不重试
3. fallback 生效与事件记录
4. REPL 命令解析与审批分支
5. 并行执行上限与 join 汇总正确性

## 8. 验收标准

### Phase 1 DoD
1. 事件过滤订阅可用并有测试覆盖
2. JSONL 持久化可用并默认开启
3. `--verbose` 可实时看到关键事件流
4. publish 强校验防止脏事件进入主链路

### Phase 2 DoD
1. LLM 短暂故障下可自动重试与降级
2. REPL 模式支持多轮输入与 revise 审批
3. 并行执行在配置上限内稳定运行
4. 最终汇总与 evaluator 决策一致可复盘

## 9. 交付顺序

1. 先交付 Phase 1 并通过全量测试
2. 再交付 Phase 2 并完成回归验证
3. 每阶段独立提交与验证报告
