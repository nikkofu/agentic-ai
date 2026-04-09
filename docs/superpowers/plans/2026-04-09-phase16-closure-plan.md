# Phase 16 Closure Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining Phase 16 gaps so memory and Dream become default-on, product-visible, and behaviorally real instead of partially wired primitives.

**Architecture:** Keep the existing Phase 16 structure, but add the missing state transitions and default wiring. This closure plan does not open a new phase; it only finishes memory lifecycle automation, Dream triggering, and product-surface truth for the existing Phase 16 system.

**Tech Stack:** TypeScript, Node.js filesystem APIs, existing runtime services, taskLifecycle inspector, Vitest, Next.js UI.

---

## File Structure

### Existing Runtime Files To Modify

- Modify: `src/runtime/runtimeServices.ts`
  - Wire real `memoryInspector` and `dreamInspector` into the default lifecycle path.
- Modify: `src/runtime/memoryEngine.ts`
  - Add missing `curate`, `compress`, `demote`, and `forget` operations.
- Modify: `src/runtime/executor.ts`
  - Trigger automatic promotion/compression after task completion where policy allows.
- Modify: `src/runtime/dreamRuntime.ts`
  - Keep generation logic but expose a stable inspection-friendly output format.
- Modify: `src/runtime/taskLifecycle.ts`
  - Surface non-zero default memory and Dream summaries from the wired inspectors.
- Modify: `src/runtime/memoryInjection.ts`
  - Add bounded ranking and de-duplication across injected layers.

### New Runtime Files

- Create: `src/runtime/memoryInspectors.ts`
  - Shared `createMemoryInspector()` and `createDreamInspector()` helpers for runtime services.
- Create: `src/runtime/dreamScheduler.ts`
  - Safe idle-trigger shim that invokes Dream runtime without external actions.

### Existing UI Files To Modify

- Modify: `ui/components/MemoryPanel.tsx`
  - Show freshness/empty-state truth more clearly once default inspectors are live.
- Modify: `ui/components/TaskLifecyclePanel.tsx`
  - Display real default memory/dream summaries and a Dream freshness line.

### Tests To Add

- Create: `tests/unit/memoryInspectors.test.ts`
- Create: `tests/unit/dreamScheduler.test.ts`
- Create: `tests/integration/phase16-default-memory-surface.test.ts`
- Extend: `tests/unit/memoryEngine.test.ts`
- Extend: `tests/unit/memoryInjection.test.ts`
- Extend: `tests/unit/taskLifecycle.test.ts`

### Docs To Modify

- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Create: `docs/phase-handoff-playbook/2026-04-09-phase16-closure-handoff.md`

## Task 1: Default Memory And Dream Inspector Wiring

**Files:**
- Create: `src/runtime/memoryInspectors.ts`
- Modify: `src/runtime/runtimeServices.ts`
- Modify: `src/runtime/taskLifecycle.ts`
- Test: `tests/unit/memoryInspectors.test.ts`
- Test: `tests/integration/phase16-default-memory-surface.test.ts`

- [ ] **Step 1: Write the failing inspector unit test**

Add a test that creates a memory engine with seeded entries and confirms:
- `createMemoryInspector().inspect(taskId)` returns non-zero counts
- `createDreamInspector().inspect(taskId)` returns latest reflections/recommendations

- [ ] **Step 2: Write the failing default runtime integration test**

Add a test that uses `createRuntimeServices()` with seeded memory/dream artifacts and confirms:
- `taskLifecycle.inspectTask(taskId).runtimeInspector.memory.project.count > 0`
- `taskLifecycle.inspectTask(taskId).runtimeInspector.dream.reflectionsCount > 0`

- [ ] **Step 3: Run tests to verify they fail**

Run:
```bash
npx vitest run tests/unit/memoryInspectors.test.ts tests/integration/phase16-default-memory-surface.test.ts
```

Expected: FAIL because default runtime services do not yet wire inspectors.

- [ ] **Step 4: Implement inspector helpers and wire them**

Implement:
- `createMemoryInspector({ memoryStore })`
- `createDreamInspector({ repoRoot, userHome })`
- pass both into `createTaskLifecycle()` from `createRuntimeServices()`

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
npx vitest run tests/unit/memoryInspectors.test.ts tests/integration/phase16-default-memory-surface.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/runtime/memoryInspectors.ts src/runtime/runtimeServices.ts src/runtime/taskLifecycle.ts tests/unit/memoryInspectors.test.ts tests/integration/phase16-default-memory-surface.test.ts
git commit -m "phase16: wire default memory and dream inspectors"
```

## Task 2: Auto-Curate And Auto-Compress Pipeline

**Files:**
- Modify: `src/runtime/memoryEngine.ts`
- Modify: `src/runtime/executor.ts`
- Test: `tests/unit/memoryEngine.test.ts`
- Test: `tests/integration/phase16-memory-productization.test.ts`

- [ ] **Step 1: Write the failing memory state-transition test**

Add tests that:
- record raw task/project entries
- call `curate(...)`
- call `compress(...)`
- assert curated/compressed entries are created

- [ ] **Step 2: Write the failing executor automation test**

Add a test that verifies successful task completion causes:
- raw task write
- curated project summary
- compressed project summary when enough curated entries exist

- [ ] **Step 3: Run tests to verify they fail**

Run:
```bash
npx vitest run tests/unit/memoryEngine.test.ts tests/integration/phase16-memory-productization.test.ts
```

Expected: FAIL with missing methods or failed expectations.

- [ ] **Step 4: Implement minimal state-transition pipeline**

Implement in `memoryEngine`:
- `curate({ layer, taskId? })`
- `compress({ layer, taskId? })`

Implement in `executor`:
- call curation/compression after successful finalize where policy allows

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
npx vitest run tests/unit/memoryEngine.test.ts tests/integration/phase16-memory-productization.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/runtime/memoryEngine.ts src/runtime/executor.ts tests/unit/memoryEngine.test.ts tests/integration/phase16-memory-productization.test.ts
git commit -m "phase16: add auto-curate and compress pipeline"
```

## Task 3: Demote And Forget Behaviors

**Files:**
- Modify: `src/runtime/memoryEngine.ts`
- Test: `tests/unit/memoryEngine.test.ts`

- [ ] **Step 1: Write the failing demote/forget tests**

Add tests that:
- demote curated entry back to raw
- forget an entry and ensure it no longer appears in retrieval

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/unit/memoryEngine.test.ts
```

Expected: FAIL because methods do not exist.

- [ ] **Step 3: Implement minimal demote/forget**

Implement:
- `demote({ id, toState })`
- `forget({ id })`

Prefer soft-delete semantics only if trivial; otherwise removal is acceptable for closure.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run tests/unit/memoryEngine.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/runtime/memoryEngine.ts tests/unit/memoryEngine.test.ts
git commit -m "phase16: add memory demote and forget operations"
```

## Task 4: Dream Idle Trigger

**Files:**
- Create: `src/runtime/dreamScheduler.ts`
- Modify: `src/runtime/runtimeServices.ts`
- Test: `tests/unit/dreamScheduler.test.ts`
- Test: `tests/integration/phase16-dream-runtime.test.ts`

- [ ] **Step 1: Write the failing scheduler test**

Add a test that:
- seeds task failures and memory entries
- calls a scheduler helper with `idleMinutes >= threshold`
- expects Dream runtime to run once

- [ ] **Step 2: Write the failing integration test**

Add an integration case proving:
- scheduler trigger creates dream artifacts through the default service wiring

- [ ] **Step 3: Run tests to verify they fail**

Run:
```bash
npx vitest run tests/unit/dreamScheduler.test.ts tests/integration/phase16-dream-runtime.test.ts
```

Expected: FAIL because no scheduler exists.

- [ ] **Step 4: Implement a safe idle-trigger shim**

Implement:
- `createDreamScheduler({ dreamRuntime, thresholdMinutes })`
- `maybeRunIdleCycle({ idleMinutes, taskFailures, memoryEntries })`

Wire it into runtime services, but keep it opt-in / safe / no external actions.

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
npx vitest run tests/unit/dreamScheduler.test.ts tests/integration/phase16-dream-runtime.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/runtime/dreamScheduler.ts src/runtime/runtimeServices.ts tests/unit/dreamScheduler.test.ts tests/integration/phase16-dream-runtime.test.ts
git commit -m "phase16: add safe dream idle trigger"
```

## Task 5: Memory Injection Ranking And Product Truth

**Files:**
- Modify: `src/runtime/memoryInjection.ts`
- Modify: `ui/components/MemoryPanel.tsx`
- Modify: `ui/components/TaskLifecyclePanel.tsx`
- Test: `tests/unit/memoryInjection.test.ts`
- Test: `tests/unit/ui-memory-panel.test.ts`

- [ ] **Step 1: Write the failing ranking test**

Add tests that prove:
- duplicate bodies across layers are de-duplicated
- injection respects layer priority
- result count stays bounded

- [ ] **Step 2: Write the failing UI truth test**

Add tests that prove the panel shows:
- non-empty counts
- empty-state wording when no memory exists
- Dream freshness summary when reflections are present

- [ ] **Step 3: Run tests to verify they fail**

Run:
```bash
npx vitest run tests/unit/memoryInjection.test.ts tests/unit/ui-memory-panel.test.ts
```

Expected: FAIL with new expectations.

- [ ] **Step 4: Implement minimal ranking and clearer product truth**

Implement:
- bounded de-duplication
- layer-priority ordering
- memory freshness line in UI

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
npx vitest run tests/unit/memoryInjection.test.ts tests/unit/ui-memory-panel.test.ts
cd ui && npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/runtime/memoryInjection.ts ui/components/MemoryPanel.tsx ui/components/TaskLifecyclePanel.tsx tests/unit/memoryInjection.test.ts tests/unit/ui-memory-panel.test.ts
git commit -m "phase16: improve memory injection and product truth"
```

## Task 6: Release-Grade Closure Proofs And Docs

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Create: `docs/phase-handoff-playbook/2026-04-09-phase16-closure-handoff.md`

- [ ] **Step 1: Run the focused closure verification suite**

Run:
```bash
npx vitest run tests/unit/memoryContracts.test.ts tests/unit/memoryMarkdown.test.ts tests/unit/memoryIndex.test.ts tests/unit/memoryEngine.test.ts tests/unit/memoryInjection.test.ts tests/unit/dreamRuntime.test.ts tests/unit/dreamScheduler.test.ts tests/unit/memoryInspectors.test.ts tests/unit/taskLifecycle.test.ts tests/unit/ui-memory-panel.test.ts tests/integration/phase16-memory-productization.test.ts tests/integration/phase16-dream-runtime.test.ts tests/integration/phase16-default-memory-surface.test.ts
cd ui && npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 2: Update docs**

Document:
- default memory surface is now wired
- auto-curate/compress exists
- Dream idle trigger exists
- demote/forget now exist

- [ ] **Step 3: Write closure handoff**

Create:
- `docs/phase-handoff-playbook/2026-04-09-phase16-closure-handoff.md`

- [ ] **Step 4: Commit**

```bash
git add README.md CHANGELOG.md docs/phase-handoff-playbook/2026-04-09-phase16-closure-handoff.md
git commit -m "phase16: close remaining memory productization gaps"
```
