# 2026-04-10 Phase 19 Completion Harness Design

## Goal

在已经完成的 `Phase 14` 真实交付平台、`Phase 15` verifier acceptance boundary、`Phase 17` 持续助理界面、以及 `Phase 18` 深度记忆演化之上，把项目推进到一个能被持续证明“真的更会完成任务”的阶段。

`Phase 19` 的重点不是再加新的任务族，也不是把 dashboard 做成更花哨的运营台，而是把“完成能力”本身产品化成可记录、可回放、可度量、可作为 release gate 的一等公民。

## Why This Phase Comes Next

当前仓库已经具备：

- family-aware delivery truth
- verifier-backed acceptance proof
- lifecycle inspection
- persistent conversation continuity
- memory evolution and companionship context

但还缺少一层把这些能力转成长期完成优势的数据与治理闭环：

- 没有统一 benchmark run ledger
- 没有 completion / acceptance / blocked rate 的持续统计
- 没有 task-family 级别的 release gate
- 没有把 release 是否可发建立在 completion evidence 上

因此 `Phase 19` 的职责是让“这个 runtime 真的越来越会完成任务”变成可验证事实，而不是叙述。

## Scope

### In scope

- benchmark record contract
- replay-friendly completion ledger
- task-family completion metrics
- accepted / blocked / revised rate tracking
- inspector-visible completion evidence
- dashboard-visible completion summary
- release gate evaluation based on completion evidence
- test-backed benchmark fixtures for release verification

### Out of scope

- 真实线上基准任务市场
- 分布式 benchmark worker farm
- 复杂统计看板或历史趋势图系统
- 自动 push GitHub release / changelog bot
- 重新设计 verifier 或 memory lifecycle

## Recommended Approach

### Approach A: Test-suite-only harness

只增加一批 integration tests，把它们当作 benchmark suite。

优点：

- 成本最低
- 最快形成回归保护

缺点：

- runtime 本身看不到 benchmark truth
- release gate 只能存在于 CI/test 约定里

### Approach B: Runtime ledger without product surface

记录 benchmark/completion ledger，并提供 release gate，但不进入 inspection/UI。

优点：

- runtime 内有完成度真值
- release gate 可编程

缺点：

- 用户/开发者在产品表面上看不到结果
- 不利于后续 control center 演化

### Approach C: Runtime ledger + inspection/UI + release gate

建立 completion harness 模块，记录完成证据，暴露 inspection summary，并把 release readiness 作为一等公民展示。

优点：

- 兼顾 runtime truth、回归验证、产品可见性
- 与项目现有 verifier / inspector / control-center 设计完全同向

缺点：

- 实现范围最大

## Recommendation

采用 **Approach C**。

这个项目的差异化从来不是“能跑任务”，而是“能证明完成”。`Phase 19` 应该直接把这种证明推进到 benchmark / release 级别。

## Architecture

`Phase 19` 增加四个核心对象：

1. `completionHarness`
2. `completionLedger`
3. `releaseGate`
4. `completionInspector`

### 1. completionHarness

负责把一次任务运行归档为 benchmark/completion record：

- task family
- final state
- delivery status
- acceptance decision
- verifier summary
- artifact / verification counts
- whether the run counts as a successful completion sample

### 2. completionLedger

把运行记录持久化为本地可回放 ledger：

- append-only run records
- latest per-family samples
- aggregate summary

第一版使用 markdown/json-first 本地文件，不引入新数据库。

### 3. releaseGate

根据 ledger 统计得出 release readiness：

- required families must have recent accepted samples
- blocked/reject rate must stay below configured threshold
- completion rate must stay above threshold
- summary must explain why a release is ready or blocked

### 4. completionInspector

把 harness summary 暴露给 `taskLifecycle.inspectTask()` 与 dashboard：

- latest benchmark sample
- family completion scorecard
- release readiness summary

## Data Model

### CompletionRecord

```ts
type CompletionRecord = {
  id: string;
  taskId: string;
  family: string;
  taskInput: string;
  finalState: "completed" | "aborted";
  deliveryStatus: string;
  acceptanceDecision: "accept" | "revise" | "reject" | "unverified";
  verifierSummary: string;
  artifactCount: number;
  verificationCount: number;
  successfulCompletion: boolean;
  countedAt: string;
};
```

### FamilyCompletionSummary

```ts
type FamilyCompletionSummary = {
  family: string;
  totalRuns: number;
  successfulRuns: number;
  acceptedRuns: number;
  blockedRuns: number;
  completionRate: number;
  acceptanceRate: number;
  latestTaskId?: string;
  latestVerifierSummary?: string;
};
```

### ReleaseGateResult

```ts
type ReleaseGateResult = {
  ready: boolean;
  requiredFamilies: string[];
  checkedFamilies: FamilyCompletionSummary[];
  reasons: string[];
};
```

## Success Criteria

- every completed or blocked runtime execution can produce a completion record
- runtime inspection shows completion evidence and release readiness
- dashboard renders a dedicated completion harness summary
- release gate can fail with explicit reasons when evidence is insufficient
- a version release can be justified by fresh benchmark evidence, not only by changed files
