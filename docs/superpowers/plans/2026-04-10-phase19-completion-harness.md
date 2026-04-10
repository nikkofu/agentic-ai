# Phase 19 Completion Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把任务完成能力沉淀为可记录、可汇总、可作为 release gate 的 completion harness，并以一个新版本发布收口。

**Architecture:** 在现有 `executor + taskLifecycle + verifier acceptance + dashboard inspector` 之上，新增 `completionHarness` 模块负责记录 run ledger、聚合 family scorecard、计算 release gate，并让 inspection/UI 能直接展示 completion evidence。

**Tech Stack:** TypeScript, Vitest, local JSON persistence, existing runtime executor/taskLifecycle/dashboard surface

---

## File Map

### New files

- `src/runtime/completionHarness.ts`
  - benchmark/completion record persistence, family summary, release gate
- `ui/components/CompletionHarnessPanel.tsx`
  - render family scorecards and release readiness
- `tests/unit/completionHarness.test.ts`
- `tests/unit/ui-completion-harness-panel.test.ts`
- `tests/integration/phase19-completion-harness.test.ts`

### Existing files to modify

- `src/runtime/executor.ts`
  - append completion records after final delivery settles
- `src/runtime/runtimeServices.ts`
  - wire completion harness into runtime services
- `src/runtime/taskLifecycle.ts`
  - expose completion summary on runtime inspector
- `ui/components/TaskLifecyclePanel.tsx`
  - render completion harness panel
- `tests/unit/taskLifecycle.test.ts`
- `README.md`
- `CHANGELOG.md`
- `package.json`
- `package-lock.json`
- `diary/2026-04-10-v1.8.0.md`

---

### Task 1: Completion Contracts and Ledger

**Files:**
- Create: `tests/unit/completionHarness.test.ts`
- Create: `src/runtime/completionHarness.ts`

- [ ] **Step 1: Write failing ledger tests**

Cover:
- accepted run counts as successful completion
- blocked or rejected run does not count as successful completion
- family summary computes completion and acceptance rates
- release gate fails when required family has no accepted sample

- [ ] **Step 2: Run targeted test and verify failure**

Run:
```bash
npx vitest run tests/unit/completionHarness.test.ts
```
Expected:
- FAIL because completion harness does not exist

- [ ] **Step 3: Implement completion harness**

Implement:
- `createCompletionHarness(...)`
- `appendRecord(...)`
- `listRecords(...)`
- `summarizeFamilies(...)`
- `evaluateReleaseGate(...)`

- [ ] **Step 4: Re-run targeted test**

Run:
```bash
npx vitest run tests/unit/completionHarness.test.ts
```
Expected:
- PASS

---

### Task 2: Executor Integration and End-to-End Recording

**Files:**
- Modify: `src/runtime/executor.ts`
- Modify: `src/runtime/runtimeServices.ts`
- Create: `tests/integration/phase19-completion-harness.test.ts`

- [ ] **Step 1: Write failing integration test**

Cover:
- accepted research execution writes a completion record
- harness summary includes the family scorecard
- release gate becomes ready after accepted evidence exists

- [ ] **Step 2: Run targeted integration test and verify failure**

Run:
```bash
npx vitest run tests/integration/phase19-completion-harness.test.ts
```
Expected:
- FAIL because runtime does not record completion evidence

- [ ] **Step 3: Integrate harness into executor/runtime services**

Implement:
- append completion record when execute/resume closes
- derive acceptance decision from final delivery
- make runtime services construct one shared harness rooted at repo data

- [ ] **Step 4: Re-run targeted integration test**

Run:
```bash
npx vitest run tests/integration/phase19-completion-harness.test.ts
```
Expected:
- PASS

---

### Task 3: Inspection and Dashboard Surface

**Files:**
- Modify: `src/runtime/taskLifecycle.ts`
- Modify: `tests/unit/taskLifecycle.test.ts`
- Create: `ui/components/CompletionHarnessPanel.tsx`
- Modify: `ui/components/TaskLifecyclePanel.tsx`
- Create: `tests/unit/ui-completion-harness-panel.test.ts`

- [ ] **Step 1: Write failing inspection/UI tests**

Cover:
- `inspectTask()` returns completion harness summary
- panel renders release readiness and per-family rates

- [ ] **Step 2: Run targeted tests and verify failure**

Run:
```bash
npx vitest run tests/unit/taskLifecycle.test.ts tests/unit/ui-completion-harness-panel.test.ts
```
Expected:
- FAIL because completion summary is not exposed/rendered

- [ ] **Step 3: Implement inspection and UI surface**

Implement:
- completion summary on `runtimeInspector`
- dashboard panel with readiness banner and family scorecards

- [ ] **Step 4: Re-run targeted tests**

Run:
```bash
npx vitest run tests/unit/taskLifecycle.test.ts tests/unit/ui-completion-harness-panel.test.ts
```
Expected:
- PASS

---

### Task 4: Release Gate and Version Publish

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `diary/2026-04-10-v1.8.0.md`

- [ ] **Step 1: Run focused Phase 19 verification suite**

Run:
```bash
npx vitest run tests/unit/completionHarness.test.ts tests/unit/taskLifecycle.test.ts tests/unit/ui-completion-harness-panel.test.ts tests/integration/phase19-completion-harness.test.ts
```
Expected:
- PASS

- [ ] **Step 2: Run full project test suite**

Run:
```bash
npm test
```
Expected:
- PASS

- [ ] **Step 3: Update release artifacts**

Update:
- version `1.7.0` -> `1.8.0`
- changelog `Unreleased` and `1.8.0` entry
- README current version and roadmap
- release diary entry for `v1.8.0`

- [ ] **Step 4: Verify release gate with fresh evidence**

Run:
```bash
npx vitest run tests/integration/phase19-completion-harness.test.ts
```
Expected:
- PASS with accepted completion evidence

- [ ] **Step 5: Commit and tag release**

```bash
git add src/runtime/completionHarness.ts src/runtime/executor.ts src/runtime/runtimeServices.ts src/runtime/taskLifecycle.ts ui/components/CompletionHarnessPanel.tsx ui/components/TaskLifecyclePanel.tsx tests/unit/completionHarness.test.ts tests/unit/taskLifecycle.test.ts tests/unit/ui-completion-harness-panel.test.ts tests/integration/phase19-completion-harness.test.ts README.md CHANGELOG.md package.json package-lock.json diary/2026-04-10-v1.8.0.md docs/superpowers/specs/2026-04-10-phase19-completion-harness-design.md docs/superpowers/plans/2026-04-10-phase19-completion-harness.md
git commit -m "feat: add phase19 completion harness"
git tag v1.8.0
```
