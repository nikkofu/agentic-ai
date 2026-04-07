# Agentic Runtime Kernel (MVP) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript/Node.js single-machine multi-agent runtime kernel with event-driven orchestration, BFS/DFS scheduling, recursive child-agent guardrails, Local+MCP tool gateway, OpenRouter responses routing, and quality/cost/latency evaluation.

**Architecture:** Implement an event-driven core around `TaskGraph` + `TaskNode` state transitions. Keep modules small and explicit: orchestrator, scheduler, runtime, prompt composer, model router, tool gateway, evaluator, guardrails, and event log store. Drive implementation with TDD: each module starts with failing tests, then minimal code, then integration tests.

**Tech Stack:** TypeScript (Node.js), Vitest, Zod, YAML config, OpenRouter Responses API, MCP client protocol.

---

## 0) File Structure (locked before coding)

### Create
- `package.json`
- `tsconfig.json`
- `vitest.config.ts`
- `src/index.ts`
- `src/types/runtime.ts`
- `src/config/loadRuntimeConfig.ts`
- `src/core/orchestrator.ts`
- `src/core/eventBus.ts`
- `src/core/eventLogStore.ts`
- `src/scheduler/policy.ts`
- `src/scheduler/scheduler.ts`
- `src/agents/agentRuntime.ts`
- `src/prompt/promptComposer.ts`
- `src/model/openrouterClient.ts`
- `src/model/modelRouter.ts`
- `src/tools/toolGateway.ts`
- `src/tools/localToolRegistry.ts`
- `src/tools/mcpClient.ts`
- `src/eval/evaluator.ts`
- `src/guardrails/guardrails.ts`
- `src/cli/runTask.ts`
- `config/runtime.yaml`
- `tests/unit/scheduler.test.ts`
- `tests/unit/guardrails.test.ts`
- `tests/unit/evaluator.test.ts`
- `tests/unit/promptComposer.test.ts`
- `tests/unit/modelRouter.test.ts`
- `tests/unit/toolGateway.test.ts`
- `tests/unit/orchestrator-state.test.ts`
- `tests/integration/e2e-runtime.test.ts`
- `tests/fixtures/localTools/echoTool.ts`
- `tests/fixtures/mcp/mockMcpServer.ts`

### Modify
- `docs/superpowers/specs/2026-04-07-agentic-runtime-design.md` (only if plan/spec mismatch found during implementation)

---

### Task 1: Initialize project and test harness

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`
- Test: `package.json` scripts

- [ ] **Step 1: Write minimal project bootstrap files**
```json
{
  "name": "agentic-ai",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Install dependencies**
Run: `npm install -D typescript vitest @types/node tsx`
Run: `npm install zod yaml`

- [ ] **Step 3: Verify empty test harness runs**
Run: `npm test`
Expected: PASS with 0 tests or no failing tests.

- [ ] **Step 4: Commit bootstrap**
```bash
git add package.json tsconfig.json vitest.config.ts src/index.ts
git commit -m "chore: initialize typescript runtime project"
```

---

### Task 2: Define runtime domain types and config loader

**Files:**
- Create: `src/types/runtime.ts`, `src/config/loadRuntimeConfig.ts`, `config/runtime.yaml`
- Test: `tests/unit/orchestrator-state.test.ts` (type/state shape checks via constructor)

- [ ] **Step 1: Write failing test for config loading and validation**
Run: `npm test -- tests/unit/orchestrator-state.test.ts`
Expected: FAIL (missing config loader/types)

- [ ] **Step 2: Implement minimal runtime schema using Zod**
Include: `TaskGraph`, `TaskNode`, `EvalDecision`, config schema (`models`, `reasoner`, `scheduler`, `guardrails`, `evaluator.weights`).

- [ ] **Step 3: Add default `config/runtime.yaml` matching spec defaults**
Include defaults: BFS, max_depth/max_branch/max_steps/max_budget, evaluator weights.

- [ ] **Step 4: Re-run test**
Run: `npm test -- tests/unit/orchestrator-state.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit domain/config layer**
```bash
git add src/types/runtime.ts src/config/loadRuntimeConfig.ts config/runtime.yaml tests/unit/orchestrator-state.test.ts
git commit -m "feat: add runtime domain types and validated config loader"
```

---

### Task 3: Implement scheduler policies (BFS/DFS)

**Files:**
- Create: `src/scheduler/policy.ts`, `src/scheduler/scheduler.ts`
- Test: `tests/unit/scheduler.test.ts`

- [ ] **Step 1: Write failing tests for BFS and DFS selection**
Test cases: same frontier input, BFS selects queue-head, DFS selects stack-top.

- [ ] **Step 2: Run scheduler tests to confirm failure**
Run: `npm test -- tests/unit/scheduler.test.ts`
Expected: FAIL with unimplemented scheduler.

- [ ] **Step 3: Implement minimal `select(frontier, policy)`**
No abstraction beyond needed behavior.

- [ ] **Step 4: Run scheduler tests again**
Run: `npm test -- tests/unit/scheduler.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit scheduler**
```bash
git add src/scheduler/policy.ts src/scheduler/scheduler.ts tests/unit/scheduler.test.ts
git commit -m "feat: implement bfs and dfs scheduler selection"
```

---

### Task 4: Implement guardrails for recursive child spawning

**Files:**
- Create: `src/guardrails/guardrails.ts`
- Test: `tests/unit/guardrails.test.ts`

- [ ] **Step 1: Write failing tests for depth/branch/steps/budget limits**
Cover pass + fail paths and emitted violation reason.

- [ ] **Step 2: Run guardrail tests to confirm failure**
Run: `npm test -- tests/unit/guardrails.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement minimal guardrail checker**
Return `{ allowed: boolean, reason?: string }`.

- [ ] **Step 4: Re-run tests**
Run: `npm test -- tests/unit/guardrails.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit guardrails**
```bash
git add src/guardrails/guardrails.ts tests/unit/guardrails.test.ts
git commit -m "feat: add recursive execution guardrails"
```

---

### Task 5: Implement evaluator and decision thresholds

**Files:**
- Create: `src/eval/evaluator.ts`
- Test: `tests/unit/evaluator.test.ts`

- [ ] **Step 1: Write failing tests for decision mapping**
Cases: `continue`, `revise`, `stop`, `escalate` hard-conditions.

- [ ] **Step 2: Run evaluator tests to confirm failure**
Run: `npm test -- tests/unit/evaluator.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement weighted scoring + threshold logic**
Defaults: `>=0.75 continue`, `0.55-0.75 revise`, `<0.55 stop`, hard-condition escalate.

- [ ] **Step 4: Re-run tests**
Run: `npm test -- tests/unit/evaluator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit evaluator**
```bash
git add src/eval/evaluator.ts tests/unit/evaluator.test.ts
git commit -m "feat: add quality-cost-latency evaluator"
```

---

### Task 6: Implement prompt composer and model router

**Files:**
- Create: `src/prompt/promptComposer.ts`, `src/model/modelRouter.ts`, `src/model/openrouterClient.ts`
- Test: `tests/unit/promptComposer.test.ts`, `tests/unit/modelRouter.test.ts`

- [ ] **Step 1: Write failing tests for structured prompt composition**
Assert payload contains: `system, role, task, context, tools, memory, constraints, output_schema`.

- [ ] **Step 2: Write failing tests for role-based model/reasoner routing**
Assert role override > default fallback.

- [ ] **Step 3: Run both test files to confirm failure**
Run: `npm test -- tests/unit/promptComposer.test.ts tests/unit/modelRouter.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement minimal composer and router**
OpenRouter client should be a thin adapter with explicit request/response typing.

- [ ] **Step 5: Re-run both tests**
Run: `npm test -- tests/unit/promptComposer.test.ts tests/unit/modelRouter.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit prompt/model layer**
```bash
git add src/prompt/promptComposer.ts src/model/modelRouter.ts src/model/openrouterClient.ts tests/unit/promptComposer.test.ts tests/unit/modelRouter.test.ts
git commit -m "feat: add structured prompt composer and model routing"
```

---

### Task 7: Implement tool gateway (Local + MCP)

**Files:**
- Create: `src/tools/toolGateway.ts`, `src/tools/localToolRegistry.ts`, `src/tools/mcpClient.ts`
- Test: `tests/unit/toolGateway.test.ts`, fixtures under `tests/fixtures/localTools/` and `tests/fixtures/mcp/`

- [ ] **Step 1: Write failing tests for local tool invocation schema**
Assert normalized output: `ok/data/error/latencyMs/costMeta`.

- [ ] **Step 2: Write failing tests for MCP invocation success/failure mapping**
Include timeout/auth/protocol mismatch mapping to recoverable/non-recoverable errors.

- [ ] **Step 3: Run tool gateway tests to confirm failure**
Run: `npm test -- tests/unit/toolGateway.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement minimal gateway + adapters**
No gRPC/JSON-RPC support yet; reserve extension points only.

- [ ] **Step 5: Re-run tests**
Run: `npm test -- tests/unit/toolGateway.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit tool gateway**
```bash
git add src/tools/toolGateway.ts src/tools/localToolRegistry.ts src/tools/mcpClient.ts tests/unit/toolGateway.test.ts tests/fixtures/localTools/echoTool.ts tests/fixtures/mcp/mockMcpServer.ts
git commit -m "feat: add local and mcp tool gateway"
```

---

### Task 8: Implement orchestrator loop and node state machine

**Files:**
- Create: `src/core/eventBus.ts`, `src/core/eventLogStore.ts`, `src/core/orchestrator.ts`, `src/agents/agentRuntime.ts`
- Test: `tests/unit/orchestrator-state.test.ts`

- [ ] **Step 1: Write failing tests for node state transitions**
Required path: `pending -> running -> waiting_tool -> evaluating -> completed|failed|aborted`.

- [ ] **Step 2: Write failing tests for event emission coverage**
Require minimal events list from spec.

- [ ] **Step 3: Run orchestrator unit tests to confirm failure**
Run: `npm test -- tests/unit/orchestrator-state.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement minimal event bus, log store, and orchestrator loop**
Ensure guardrail checks happen before child spawn.

- [ ] **Step 5: Re-run orchestrator tests**
Run: `npm test -- tests/unit/orchestrator-state.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit orchestrator core**
```bash
git add src/core/eventBus.ts src/core/eventLogStore.ts src/core/orchestrator.ts src/agents/agentRuntime.ts tests/unit/orchestrator-state.test.ts
git commit -m "feat: implement event-driven orchestrator and state machine"
```

---

### Task 9: Add CLI entrypoint and end-to-end integration test

**Files:**
- Create: `src/cli/runTask.ts`, `tests/integration/e2e-runtime.test.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write failing end-to-end test for full loop**
Test assertions:
1) task submits and closes,
2) at least one child agent spawn,
3) local + MCP tool calls succeed,
4) evaluator decisions produced,
5) summary generated.

- [ ] **Step 2: Run integration test to confirm failure**
Run: `npm test -- tests/integration/e2e-runtime.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement CLI flow wiring orchestrator + config + adapters**
Expose command: `tsx src/cli/runTask.ts --input "..."`.

- [ ] **Step 4: Re-run integration test**
Run: `npm test -- tests/integration/e2e-runtime.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full test suite**
Run: `npm test`
Expected: PASS all unit + integration tests.

- [ ] **Step 6: Commit CLI and e2e**
```bash
git add src/cli/runTask.ts src/index.ts tests/integration/e2e-runtime.test.ts
git commit -m "feat: deliver mvp runtime e2e loop"
```

---

### Task 10: Final verification checklist before completion

**Files:**
- Verify only; no required new files

- [ ] **Step 1: Run build**
Run: `npm run build`
Expected: PASS.

- [ ] **Step 2: Re-run full tests**
Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Validate DoD against spec**
Manual check against 7 acceptance points in spec section 9.

- [ ] **Step 4: Prepare execution summary**
Include: node count, tool calls, total cost, total latency, final decision path.

- [ ] **Step 5: Final commit (if verification changes were needed)**
```bash
git add <only-if-changed-files>
git commit -m "chore: finalize mvp verification"
```

---

## Implementation Rules

- Use @superpowers:test-driven-development for every task.
- Keep each commit scoped to one task.
- Do not add gRPC/JSON-RPC runtime support in this plan (YAGNI).
- Do not add UI work in this plan (out of scope).
- If spec conflict appears, pause and update spec before continuing.
