# Runtime Enhancement (Phase 1+2) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved 6 enhancement areas: filtered EventBus subscriptions, JSONL persistence + verbose observability, schema-validated events, runtime retry/fallback, REPL interaction, and controlled parallel orchestration.

**Architecture:** Keep the current runtime structure and add capabilities in thin layers: first harden core event plumbing (filtering, validation, persistence), then add runtime resilience and orchestration enhancements. Use strict TDD at every task boundary and keep each commit scoped to one task.

**Tech Stack:** TypeScript, Node.js, Vitest, Zod, JSONL file persistence, OpenRouter client.

---

## 0) File Structure (planned changes)

### Create
- `src/core/eventSchemas.ts`
- `tests/unit/eventBus-subscribe-filter.test.ts`
- `tests/unit/eventSchemas-publish-validation.test.ts`
- `tests/unit/eventLogStore-jsonl.test.ts`
- `tests/unit/runTask-verbose.test.ts`
- `tests/unit/agentRuntime-retry-fallback.test.ts`
- `tests/unit/repl-session.test.ts`
- `tests/unit/orchestrator-parallel.test.ts`

### Modify
- `src/core/eventBus.ts`
- `src/core/eventLogStore.ts`
- `src/core/orchestrator.ts`
- `src/agents/agentRuntime.ts`
- `src/cli/runTask.ts`
- `src/config/loadRuntimeConfig.ts`
- `src/types/runtime.ts`
- `config/runtime.yaml`
- `tests/integration/e2e-runtime.test.ts`

---

### Task 1: Add EventBus filtered subscriptions

**Files:**
- Modify: `src/core/eventBus.ts`
- Test: `tests/unit/eventBus-subscribe-filter.test.ts`

- [ ] **Step 1: Write failing tests for exact and wildcard subscription**
Include cases: exact `TaskSubmitted`, wildcard `Task.*`, unsubscribe behavior.

- [ ] **Step 2: Run test to verify failure**
Run: `npm test -- tests/unit/eventBus-subscribe-filter.test.ts`
Expected: FAIL (filtering/unsubscribe not implemented).

- [ ] **Step 3: Implement minimal filtered subscription and unsubscribe**
Support patterns: exact and `<prefix>.*`.

- [ ] **Step 4: Re-run tests**
Run: `npm test -- tests/unit/eventBus-subscribe-filter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/core/eventBus.ts tests/unit/eventBus-subscribe-filter.test.ts
git commit -m "feat: support filtered event bus subscriptions"
```

---

### Task 2: Add event schema registry and publish-time validation

**Files:**
- Create: `src/core/eventSchemas.ts`
- Modify: `src/core/eventBus.ts`
- Test: `tests/unit/eventSchemas-publish-validation.test.ts`

- [ ] **Step 1: Write failing tests for publish validation**
Cases: valid event passes; missing required payload field throws.

- [ ] **Step 2: Run test to verify failure**
Run: `npm test -- tests/unit/eventSchemas-publish-validation.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement minimal Zod schema registry + publish validation hook**
Only validate at publish entry, not subscriber side.

- [ ] **Step 4: Re-run tests**
Run: `npm test -- tests/unit/eventSchemas-publish-validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/core/eventSchemas.ts src/core/eventBus.ts tests/unit/eventSchemas-publish-validation.test.ts
git commit -m "feat: validate event payloads at publish time"
```

---

### Task 3: Add JSONL persistent EventLogStore

**Files:**
- Modify: `src/core/eventLogStore.ts`
- Test: `tests/unit/eventLogStore-jsonl.test.ts`

- [ ] **Step 1: Write failing tests for JSONL append and readback**
Cases: appends one event per line, preserves type/payload/ts.

- [ ] **Step 2: Run test to verify failure**
Run: `npm test -- tests/unit/eventLogStore-jsonl.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement minimal JsonlEventLogStore**
Keep existing in-memory store unchanged for fast unit tests.

- [ ] **Step 4: Re-run tests**
Run: `npm test -- tests/unit/eventLogStore-jsonl.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/core/eventLogStore.ts tests/unit/eventLogStore-jsonl.test.ts
git commit -m "feat: add jsonl event log persistence"
```

---

### Task 4: Add CLI --verbose event streaming

**Files:**
- Modify: `src/cli/runTask.ts`
- Test: `tests/unit/runTask-verbose.test.ts`

- [ ] **Step 1: Write failing tests for --verbose output behavior**
Cases: prints timestamp + event type + key fields; still prints final JSON summary.

- [ ] **Step 2: Run test to verify failure**
Run: `npm test -- tests/unit/runTask-verbose.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement minimal verbose subscription output in CLI path**
Do not change default output when `--verbose` absent.

- [ ] **Step 4: Re-run tests**
Run: `npm test -- tests/unit/runTask-verbose.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/cli/runTask.ts tests/unit/runTask-verbose.test.ts
git commit -m "feat: add verbose event stream output"
```

---

### Task 5: Add runtime retry + model fallback

**Files:**
- Modify: `src/agents/agentRuntime.ts`, `src/config/loadRuntimeConfig.ts`, `src/types/runtime.ts`, `config/runtime.yaml`
- Test: `tests/unit/agentRuntime-retry-fallback.test.ts`

- [ ] **Step 1: Write failing tests for retry policy and fallback sequence**
Cases: retry on 429/5xx/timeout; no retry on non-429 4xx; fallback when retries exhausted.

- [ ] **Step 2: Run test to verify failure**
Run: `npm test -- tests/unit/agentRuntime-retry-fallback.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement minimal exponential backoff + fallback chain**
Config-driven retry count and fallback models.

- [ ] **Step 4: Re-run tests**
Run: `npm test -- tests/unit/agentRuntime-retry-fallback.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/agents/agentRuntime.ts src/config/loadRuntimeConfig.ts src/types/runtime.ts config/runtime.yaml tests/unit/agentRuntime-retry-fallback.test.ts
git commit -m "feat: add retry and model fallback in agent runtime"
```

---

### Task 6: Add REPL mode and revise approval commands

**Files:**
- Modify: `src/cli/runTask.ts`
- Test: `tests/unit/repl-session.test.ts`

- [ ] **Step 1: Write failing tests for REPL command parsing and flow**
Cases: `/approve`, `/reject`, `/exit`, normal message submit.

- [ ] **Step 2: Run test to verify failure**
Run: `npm test -- tests/unit/repl-session.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement minimal single-session REPL loop**
No multi-user state; local process only.

- [ ] **Step 4: Re-run tests**
Run: `npm test -- tests/unit/repl-session.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/cli/runTask.ts tests/unit/repl-session.test.ts
git commit -m "feat: add repl mode with revise approval commands"
```

---

### Task 7: Add controlled parallel execution and join

**Files:**
- Modify: `src/core/orchestrator.ts`, `src/types/runtime.ts`, `config/runtime.yaml`
- Test: `tests/unit/orchestrator-parallel.test.ts`

- [ ] **Step 1: Write failing tests for bounded parallel execution**
Cases: respects `max_parallel`; merges branch results through join before final evaluation.

- [ ] **Step 2: Run test to verify failure**
Run: `npm test -- tests/unit/orchestrator-parallel.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement minimal parallel frontier scheduling + join**
Keep guardrails enforced across aggregate execution.

- [ ] **Step 4: Re-run tests**
Run: `npm test -- tests/unit/orchestrator-parallel.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/core/orchestrator.ts src/types/runtime.ts config/runtime.yaml tests/unit/orchestrator-parallel.test.ts
git commit -m "feat: add bounded parallel orchestration with join"
```

---

### Task 8: End-to-end integration and verification

**Files:**
- Modify: `tests/integration/e2e-runtime.test.ts`

- [ ] **Step 1: Expand failing integration tests for Phase 1+2 behavior**
Include verbose path, retry/fallback path, and parallel execution path.

- [ ] **Step 2: Run integration test to confirm failure**
Run: `npm test -- tests/integration/e2e-runtime.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement minimal wiring fixes to satisfy integration tests**
Only changes required to make tests pass.

- [ ] **Step 4: Re-run integration test**
Run: `npm test -- tests/integration/e2e-runtime.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full test suite and build**
Run: `npm run build && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add tests/integration/e2e-runtime.test.ts
git commit -m "test: verify runtime enhancements end to end"
```

---

### Task 9: Final verification and handoff

**Files:**
- Verify only

- [ ] **Step 1: Run smoke command with verbose mode**
Run: `set -a && source .env && set +a && npm run run -- -p "runtime enhancement smoke" --verbose`
Expected: real-time events + final JSON summary.

- [ ] **Step 2: Run smoke command in repl mode**
Run: `set -a && source .env && set +a && npm run run -- --repl`
Expected: REPL prompt and command handling.

- [ ] **Step 3: Validate Phase 1 + 2 DoD checklist against spec**
Manual check with evidence links/log outputs.

- [ ] **Step 4: Final commit (if needed)**
```bash
git add <only-if-needed>
git commit -m "chore: finalize runtime enhancement verification"
```
