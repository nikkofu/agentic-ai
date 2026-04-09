# Phase 11 Distributed Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make queued and multi-worker execution durable by persisting async node/task results into shared task state, adding ownership and dedupe semantics, and making replay/resume operate on distributed truth instead of transient events.

**Architecture:** Build Phase 11 around a single distributed state story: queued work is claimed with explicit ownership, async completion writes back into the shared task graph, and replay/resume consumes persisted distributed state. Keep the runtime kernel unified by extending the existing `taskLifecycle`, `TaskQueue`, `agentWorker`, `persistenceManager`, and `TaskStore` contracts instead of creating parallel async-only code paths.

**Tech Stack:** TypeScript, Vitest, BullMQ, Redis, Next.js API routes, Zustand, existing runtime executor/orchestrator/task store abstractions.

---

## File Structure

### Runtime/Core
- Modify: `src/worker/queue.ts`
  - Extend queued job payloads with ownership metadata, dedupe keys, and lifecycle-safe identifiers.
- Modify: `src/worker/agentWorker.ts`
  - Publish richer async node/task result payloads and write ownership-safe result callbacks.
- Modify: `src/core/eventSchemas.ts`
  - Formalize async ownership/result event schema.
- Modify: `src/core/persistenceManager.ts`
  - Persist async node/task lifecycle changes into shared task graph state.
- Modify: `src/core/taskStore.ts`
  - Add minimal APIs needed for queued-node writeback and ownership/dedupe markers.
- Modify: `src/core/orchestrator.ts`
  - Reconcile local-vs-queue parallel execution semantics and distributed join state.
- Modify: `src/runtime/executor.ts`
  - Resume/replay against persisted distributed state, not only in-memory event flow.
- Modify: `src/runtime/taskLifecycle.ts`
  - Expose distributed inspection state cleanly to CLI/API/UI.

### API/UI
- Modify: `ui/store/useTaskStore.ts`
  - Surface ownership, queued status, async completion/failure, and distributed task-level state.
- Modify: `ui/components/TaskLifecyclePanel.tsx`
  - Show distributed job status, ownership, and dedupe/replay-relevant feedback.
- Modify: `ui/hooks/useEventStream.ts`
  - Reflect richer async events and distributed failure semantics.

### Tests
- Modify: `tests/unit/taskQueue-lifecycle.test.ts`
- Modify: `tests/unit/taskLifecycle-worker.test.ts`
- Modify: `tests/unit/persistenceManager.test.ts`
- Modify: `tests/unit/orchestrator-parallel.test.ts`
- Modify: `tests/unit/runtime-executor.test.ts`
- Modify: `tests/unit/taskLifecycle.test.ts`
- Modify: `tests/unit/ui-task-store.test.ts`
- Add if needed: `tests/integration/distributed-node-writeback.test.ts`
- Add if needed: `tests/integration/distributed-replay.test.ts`

## Task 1: Formalize Async Ownership And Result Contracts

**Files:**
- Modify: `src/worker/queue.ts`
- Modify: `src/core/eventSchemas.ts`
- Test: `tests/unit/taskQueue-lifecycle.test.ts`

- [ ] **Step 1: Write the failing tests for ownership and dedupe payloads**

Add tests that expect queued jobs to carry:
- `taskId`
- `nodeId`
- `ownerId`
- `dedupeKey`
- `enqueuedAt`

Also add a lifecycle-job test expecting deterministic dedupe-safe `jobId` generation for `start` and `resume`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/unit/taskQueue-lifecycle.test.ts`
Expected: FAIL because queue payloads and IDs do not yet include ownership/dedupe metadata.

- [ ] **Step 3: Implement minimal queue payload and job ID changes**

Update `TaskQueue` so queued node jobs and lifecycle jobs include explicit ownership/dedupe fields without changing the public queue abstraction more than necessary.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/taskQueue-lifecycle.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/worker/queue.ts tests/unit/taskQueue-lifecycle.test.ts
git commit -m "feat: add ownership metadata to queued runtime jobs"
```

## Task 2: Persist Async Node Writeback Into Shared Task State

**Files:**
- Modify: `src/worker/agentWorker.ts`
- Modify: `src/core/eventSchemas.ts`
- Modify: `src/core/persistenceManager.ts`
- Modify: `src/core/taskStore.ts`
- Test: `tests/unit/taskLifecycle-worker.test.ts`
- Test: `tests/unit/persistenceManager.test.ts`

- [ ] **Step 1: Write the failing tests for async node writeback**

Add tests that expect:
- `AsyncNodeSettled` to include `ownerId`, `delivery`, `final_result`, `blocking_reason`
- `AsyncNodeFailed` to include ownership context
- persistence layer to write async node completion/failure back into the graph with final output summary and status

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/unit/taskLifecycle-worker.test.ts tests/unit/persistenceManager.test.ts`
Expected: FAIL because async results are not yet ownership-rich and shared writeback is incomplete.

- [ ] **Step 3: Implement minimal worker and persistence changes**

Update worker result events and persistence handling so queued-node completion/failure survives outside the caller process.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/taskLifecycle-worker.test.ts tests/unit/persistenceManager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/worker/agentWorker.ts src/core/eventSchemas.ts src/core/persistenceManager.ts src/core/taskStore.ts tests/unit/taskLifecycle-worker.test.ts tests/unit/persistenceManager.test.ts
git commit -m "feat: persist async node writeback into task state"
```

## Task 3: Add Distributed Join State And Queue-Aware Parallel Semantics

**Files:**
- Modify: `src/core/orchestrator.ts`
- Modify: `src/core/taskStore.ts`
- Test: `tests/unit/orchestrator-parallel.test.ts`
- Test: `tests/integration/distributed-node-writeback.test.ts`

- [ ] **Step 1: Write the failing tests for distributed join state**

Add tests that expect:
- queue-dispatched parallel execution to record a join placeholder/state in persistence
- async node completion to contribute to join readiness
- join completion to survive process boundaries

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/unit/orchestrator-parallel.test.ts tests/integration/distributed-node-writeback.test.ts`
Expected: FAIL because queue-backed parallel execution currently returns events without distributed join persistence.

- [ ] **Step 3: Implement minimal distributed join tracking**

Add persisted join metadata using the existing task graph/task store instead of inventing a second distributed coordinator.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/orchestrator-parallel.test.ts tests/integration/distributed-node-writeback.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/orchestrator.ts src/core/taskStore.ts tests/unit/orchestrator-parallel.test.ts tests/integration/distributed-node-writeback.test.ts
git commit -m "feat: add distributed join tracking for queued nodes"
```

## Task 4: Make Replay And Resume Consume Persisted Distributed State

**Files:**
- Modify: `src/runtime/executor.ts`
- Modify: `src/runtime/taskLifecycle.ts`
- Modify: `src/core/orchestrator.ts`
- Test: `tests/integration/orchestrator-resume.test.ts`
- Test: `tests/integration/distributed-replay.test.ts`

- [ ] **Step 1: Write the failing tests for distributed replay**

Add tests that expect:
- replay after queued-node completion to rebuild effective state from persistence
- replay after worker interruption to skip already-settled nodes
- resume to use persisted distributed truth before event-log reconstruction

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/integration/orchestrator-resume.test.ts tests/integration/distributed-replay.test.ts`
Expected: FAIL because replay currently depends too heavily on event reconstruction and incomplete node states.

- [ ] **Step 3: Implement minimal distributed replay semantics**

Update resume/replay code to:
- prefer settled node state from shared task graph
- rehydrate only unfinished distributed work
- preserve existing memory replay behavior

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/integration/orchestrator-resume.test.ts tests/integration/distributed-replay.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/runtime/executor.ts src/runtime/taskLifecycle.ts src/core/orchestrator.ts tests/integration/orchestrator-resume.test.ts tests/integration/distributed-replay.test.ts
git commit -m "feat: replay distributed runtime state during resume"
```

## Task 5: Expose Distributed State Clearly Through API And Dashboard

**Files:**
- Modify: `src/runtime/taskLifecycle.ts`
- Modify: `ui/store/useTaskStore.ts`
- Modify: `ui/components/TaskLifecyclePanel.tsx`
- Modify: `ui/hooks/useEventStream.ts`
- Test: `tests/unit/taskLifecycle.test.ts`
- Test: `tests/unit/ui-task-store.test.ts`
- Test: `tests/unit/ui-event-stream-state.test.ts`

- [ ] **Step 1: Write the failing tests for distributed inspection UX**

Add tests that expect inspection/UI state to expose:
- latest async owner-aware task result
- distributed queued/running/settled state
- worker failure diagnostics that distinguish async worker failure from normal task block

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/unit/taskLifecycle.test.ts tests/unit/ui-task-store.test.ts tests/unit/ui-event-stream-state.test.ts`
Expected: FAIL because current inspection and UI state only partially project distributed semantics.

- [ ] **Step 3: Implement minimal API and UI changes**

Expose the distributed facts already persisted by earlier tasks, without redesigning the dashboard.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/taskLifecycle.test.ts tests/unit/ui-task-store.test.ts tests/unit/ui-event-stream-state.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/runtime/taskLifecycle.ts ui/store/useTaskStore.ts ui/components/TaskLifecyclePanel.tsx ui/hooks/useEventStream.ts tests/unit/taskLifecycle.test.ts tests/unit/ui-task-store.test.ts tests/unit/ui-event-stream-state.test.ts
git commit -m "feat: expose distributed runtime state in lifecycle ui"
```

## Task 6: Release-Grade Verification And Docs Update

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `docs/phase-handoff-playbook/...` if needed
- Add: `diary/YYYY-MM-DD-vX.Y.Z.md` at release time

- [ ] **Step 1: Run the full focused Phase 11 verification set**

Run:

```bash
npm test -- --run tests/unit/taskQueue-lifecycle.test.ts tests/unit/taskLifecycle-worker.test.ts tests/unit/persistenceManager.test.ts tests/unit/orchestrator-parallel.test.ts tests/unit/taskLifecycle.test.ts tests/unit/ui-task-store.test.ts tests/unit/ui-event-stream-state.test.ts tests/unit/runtime-executor.test.ts tests/integration/orchestrator-resume.test.ts tests/integration/distributed-node-writeback.test.ts tests/integration/distributed-replay.test.ts
```

Expected: PASS

- [ ] **Step 2: Run UI type verification**

Run:

```bash
cd ui && npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 3: Update docs for the completed Phase 11 scope**

Summarize distributed durability, ownership, dedupe, replay, and async UI inspection changes.

- [ ] **Step 4: Prepare release diary**

Write a personal release diary entry to `diary/` that records:
- what changed
- what felt hard
- what you learned
- what music was playing

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md README.md docs diary
git commit -m "docs: record phase 11 distributed closure release notes"
```

## Notes For Execution

- Keep Phase 11 strictly about distributed closure. Do not pull in Phase 12 prompt unification or Phase 13 visual redesign.
- Prefer extending existing runtime contracts over introducing parallel async-only abstractions.
- Treat ownership and dedupe as data-model concerns first, UI concerns second.
- Maintain local and queue execution parity wherever possible.

## Review Status

Plan written to:
- `docs/superpowers/plans/2026-04-09-phase11-distributed-closure.md`

Plan review loop not executed yet because no subagent/reviewer was requested for this turn.
