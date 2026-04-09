# Phase 12 Agent Intelligence Kernel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the post-Phase-11 runtime into a more principled agentic kernel by unifying prompt generation, making evaluator decisions typed and authoritative, formalizing invalid model output classes, and enforcing planner policy beyond simple tool gating.

**Architecture:** Build Phase 12 around a single execution truth: `ExecutionContext` flows into one production prompt pipeline, the model returns one normalized runtime envelope, evaluator outputs typed convergence decisions, and planner policy is enforced structurally at orchestration time. Avoid layering more CLI-side heuristics or prompt-only hints; deepen the runtime core instead.

**Tech Stack:** TypeScript, Vitest, existing runtime executor/orchestrator/policy/context modules, Zod schemas, local tool registry, BullMQ-backed distributed runtime already landed in Phase 11.

---

## File Structure

### Runtime/Core
- Modify: `src/core/orchestrator.ts`
  - Centralize envelope normalization, invalid-output handling, evaluator-driven decisions, and join decision enforcement.
- Modify: `src/prompt/promptComposer.ts`
  - Replace legacy prompt shape with the single production prompt path used by the runtime.
- Modify: `src/runtime/executor.ts`
  - Stop building ad hoc prompt/runtime payload fragments and defer to the unified prompt/runtime path.
- Modify: `src/runtime/contracts.ts`
  - Expand typed runtime contracts for invalid output classes, evaluator decisions, planner join decisions, and delivery constraints.
- Modify: `src/runtime/policy.ts`
  - Normalize planner policy for verification, revise bounds, capability/tool constraints, and delivery requirements.
- Modify: `src/runtime/context.ts`
  - Ensure `ExecutionContext` carries all fields needed by prompt, evaluator, policy enforcement, and join synthesis without side channels.
- Modify: `src/eval/evaluator.ts`
  - Emit typed convergence decisions rather than loose scores or implicit stop conditions.
- Modify: `src/core/eventSchemas.ts`
  - Add typed events for invalid output classification, evaluator decisions, and planner join actions.

### Planner / Intent / Join
- Modify: `src/core/intentClassifier.ts`
  - Keep intent output aligned with the stricter runtime contracts if additional convergence hints are needed.
- Modify: `src/runtime/plan.ts`
  - Align planner-expanded child and join contracts with the new typed runtime decisions.

### Tests
- Modify: `tests/unit/promptComposer.test.ts`
- Modify: `tests/unit/orchestrator-autonomous-loop.test.ts`
- Modify: `tests/unit/runtime-executor.test.ts`
- Modify: `tests/unit/runtime-planning.test.ts`
- Modify: `tests/unit/evaluator-loop-decision.test.ts`
- Add: `tests/unit/runtime-invalid-output.test.ts`
- Add: `tests/integration/phase12-prompt-pipeline.test.ts`
- Add: `tests/integration/phase12-join-policy.test.ts`

## Task 1: Unify The Production Prompt Pipeline

**Files:**
- Modify: `src/prompt/promptComposer.ts`
- Modify: `src/core/orchestrator.ts`
- Modify: `src/runtime/executor.ts`
- Test: `tests/unit/promptComposer.test.ts`
- Test: `tests/integration/phase12-prompt-pipeline.test.ts`

- [ ] **Step 1: Write the failing tests for the single production prompt path**

Add tests that expect:
- `ExecutionContext` to be the only prompt input contract
- prompt payload to include task, node role, policy, dependency outputs, working memory, and retrieval context
- orchestrator/executor to stop relying on any ad hoc prompt builder outside `promptComposer`

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/unit/promptComposer.test.ts tests/integration/phase12-prompt-pipeline.test.ts`
Expected: FAIL because the runtime still has prompt logic split across orchestrator/executor and legacy composer behavior.

- [ ] **Step 3: Implement the minimal unified prompt pipeline**

Update the runtime so:
- `promptComposer` is the single production prompt path
- `ExecutionContext` is rendered once into a typed prompt payload
- orchestrator consumes that payload directly

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/promptComposer.test.ts tests/integration/phase12-prompt-pipeline.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/prompt/promptComposer.ts src/core/orchestrator.ts src/runtime/executor.ts tests/unit/promptComposer.test.ts tests/integration/phase12-prompt-pipeline.test.ts
git commit -m "feat: unify the runtime prompt pipeline"
```

## Task 2: Introduce Invalid Output Taxonomy And Runtime Normalization

**Files:**
- Modify: `src/runtime/contracts.ts`
- Modify: `src/core/orchestrator.ts`
- Modify: `src/core/eventSchemas.ts`
- Test: `tests/unit/runtime-invalid-output.test.ts`
- Test: `tests/unit/orchestrator-autonomous-loop.test.ts`

- [ ] **Step 1: Write the failing tests for typed invalid model outputs**

Add tests that classify malformed runtime responses into explicit classes:
- `empty_delivery`
- `invalid_protocol`
- `semantic_tool_loop`
- `verification_missing`
- `policy_tool_not_allowed`

Also assert that orchestrator emits typed events and chooses recovery/block behavior based on these classes.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/unit/runtime-invalid-output.test.ts tests/unit/orchestrator-autonomous-loop.test.ts`
Expected: FAIL because invalid outputs are still handled by scattered recovery rules instead of one normalized taxonomy.

- [ ] **Step 3: Implement minimal normalization and classification**

Add a small normalization layer in orchestrator that:
- parses model output into one envelope
- classifies invalid output cause
- emits a typed event
- returns a typed recovery/block path

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/runtime-invalid-output.test.ts tests/unit/orchestrator-autonomous-loop.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/runtime/contracts.ts src/core/orchestrator.ts src/core/eventSchemas.ts tests/unit/runtime-invalid-output.test.ts tests/unit/orchestrator-autonomous-loop.test.ts
git commit -m "feat: classify invalid runtime outputs"
```

## Task 3: Make Evaluator The Sole Convergence Authority

**Files:**
- Modify: `src/eval/evaluator.ts`
- Modify: `src/core/orchestrator.ts`
- Modify: `src/runtime/contracts.ts`
- Test: `tests/unit/evaluator-loop-decision.test.ts`
- Test: `tests/unit/orchestrator-autonomous-loop.test.ts`

- [ ] **Step 1: Write the failing tests for typed evaluator decisions**

Add tests that expect evaluator to emit one of:
- `stop`
- `revise`
- `block`
- `deliver`
- `join`

Also assert orchestrator never completes a node unless evaluator explicitly allows the terminal decision.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/unit/evaluator-loop-decision.test.ts tests/unit/orchestrator-autonomous-loop.test.ts`
Expected: FAIL because some loop termination paths still complete nodes without evaluator being the single authority.

- [ ] **Step 3: Implement minimal evaluator authority changes**

Update evaluator and orchestrator so:
- evaluator returns typed convergence decisions
- orchestrator maps those decisions directly into runtime actions
- terminal node completion requires evaluator agreement

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/evaluator-loop-decision.test.ts tests/unit/orchestrator-autonomous-loop.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/eval/evaluator.ts src/core/orchestrator.ts src/runtime/contracts.ts tests/unit/evaluator-loop-decision.test.ts tests/unit/orchestrator-autonomous-loop.test.ts
git commit -m "feat: make evaluator authoritative for convergence"
```

## Task 4: Deepen Planner Policy Enforcement

**Files:**
- Modify: `src/runtime/policy.ts`
- Modify: `src/core/orchestrator.ts`
- Modify: `src/runtime/contracts.ts`
- Test: `tests/unit/runtime-planning.test.ts`
- Test: `tests/integration/phase12-join-policy.test.ts`

- [ ] **Step 1: Write the failing tests for structural planner policy enforcement**

Add tests that expect planner policy to govern:
- verification requirements
- revise bounds
- allowed capabilities
- delivery constraints
- child join behavior

Avoid prompt-only assertions; assert actual runtime behavior changes.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/unit/runtime-planning.test.ts tests/integration/phase12-join-policy.test.ts`
Expected: FAIL because planner policy is not yet deep enough to control all of these behaviors structurally.

- [ ] **Step 3: Implement minimal deeper policy enforcement**

Update policy normalization and orchestrator enforcement so:
- revise loops are bounded by policy
- delivery can be blocked by policy constraints
- join decisions obey planner policy, not just model text

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/runtime-planning.test.ts tests/integration/phase12-join-policy.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/runtime/policy.ts src/core/orchestrator.ts src/runtime/contracts.ts tests/unit/runtime-planning.test.ts tests/integration/phase12-join-policy.test.ts
git commit -m "feat: enforce planner policy across runtime decisions"
```

## Task 5: Type Join / Revise / Spawn Decisions End-To-End

**Files:**
- Modify: `src/runtime/contracts.ts`
- Modify: `src/runtime/plan.ts`
- Modify: `src/core/orchestrator.ts`
- Test: `tests/unit/orchestrator-autonomous-loop.test.ts`
- Test: `tests/unit/runtime-executor.test.ts`

- [ ] **Step 1: Write the failing tests for typed planner join decisions**

Add tests that expect planner/join outputs to normalize into:
- `deliver`
- `revise_child`
- `spawn_more`
- `block`

Also assert executor and orchestrator preserve those decisions without lossy stringly-typed branching.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/unit/orchestrator-autonomous-loop.test.ts tests/unit/runtime-executor.test.ts`
Expected: FAIL because join and planner decisions are still only partially normalized.

- [ ] **Step 3: Implement minimal typed decision flow**

Update contracts and runtime handling so planner/join decisions are:
- schema-validated
- preserved across executor and orchestrator
- mapped into deterministic runtime actions

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/orchestrator-autonomous-loop.test.ts tests/unit/runtime-executor.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/runtime/contracts.ts src/runtime/plan.ts src/core/orchestrator.ts tests/unit/orchestrator-autonomous-loop.test.ts tests/unit/runtime-executor.test.ts
git commit -m "feat: type planner join and revise decisions"
```

## Task 6: Release-Grade Verification And Documentation

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/superpowers/specs/2026-04-09-phase11-13-iteration-design.md` if scope refinement is needed
- Modify: `diary/YYYY-MM-DD-vX.Y.Z.md` during release

- [ ] **Step 1: Run the focused Phase 12 verification suite**

Run:
```bash
npm test -- --run tests/unit/promptComposer.test.ts tests/unit/runtime-invalid-output.test.ts tests/unit/evaluator-loop-decision.test.ts tests/unit/runtime-planning.test.ts tests/unit/orchestrator-autonomous-loop.test.ts tests/unit/runtime-executor.test.ts tests/integration/phase12-prompt-pipeline.test.ts tests/integration/phase12-join-policy.test.ts
```
Expected: PASS with zero failing tests.

- [ ] **Step 2: Run UI type verification if any shared contracts changed**

Run:
```bash
cd ui && npx tsc --noEmit
```
Expected: PASS

- [ ] **Step 3: Update release-facing docs**

Document:
- unified prompt pipeline
- typed invalid-output handling
- evaluator authority
- deeper planner policy enforcement
- typed join/revise/spawn decisions

- [ ] **Step 4: Commit**

```bash
git add README.md CHANGELOG.md docs/superpowers/specs/2026-04-09-phase11-13-iteration-design.md
git commit -m "docs: record phase 12 agent intelligence kernel"
```

- [ ] **Step 5: Prepare release diary and version bump**

Create:
- `diary/YYYY-MM-DD-vX.Y.Z.md`

Record:
- what changed
- what became more principled
- what still felt fragile
- what music was on

