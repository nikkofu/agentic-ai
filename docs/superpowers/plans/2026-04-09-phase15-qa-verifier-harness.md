# Phase 15 QA / Verifier Harness Plan

Date: 2026-04-09
Goal: make final handoff depend on explicit verifier acceptance instead of only produced delivery.

## Scope

Phase 15 adds a verifier-led acceptance boundary on top of the existing Phase 14 delivery platform.

Primary task families:
- `research_writing`
- `browser_workflow`

Primary outcome:
- distinguish `produced delivery` from `accepted delivery`
- attach typed findings and acceptance proof to the runtime

## Task 1: Shared Verifier Contracts And QA Finding Taxonomy

### Objective

Introduce the shared types and helpers needed for verifier-led acceptance.

### Deliverables

- `VerifierDecision`
- `QaFinding`
- `AcceptanceProof`
- family audit input types
- finding normalization helpers

### Files

- `src/runtime/contracts.ts`
- `src/runtime/qaFindings.ts`
- `tests/unit/qaFindings.test.ts`

### TDD Steps

1. Add failing tests for finding normalization and acceptance proof structure.
2. Extend runtime contracts with verifier types.
3. Add normalization helpers for findings.
4. Verify the new types are consumed without breaking existing delivery harness tests.

### Verification

```bash
npx vitest run tests/unit/qaFindings.test.ts tests/unit/deliveryHarness.test.ts
```

## Task 2: Research Verifier Flow

### Objective

Add research-specific audit logic that can accept, revise, or reject article deliveries.

### Deliverables

- research family audit function
- trust findings for:
  - verification gaps
  - source coverage gaps
  - invalid references artifact
  - invalid final article artifact
- acceptance proof for research deliveries

### Files

- `src/runtime/familyAudit.ts`
- `src/runtime/researchWriting.ts`
- `src/core/deliveryArtifacts.ts`
- `tests/unit/familyAudit.test.ts`
- `tests/integration/phase15-research-verifier-accept.test.ts`
- `tests/integration/phase15-research-verifier-reject.test.ts`

### TDD Steps

1. Add failing tests for accepted research delivery.
2. Add failing tests for rejected research delivery with missing references artifact.
3. Implement research audit rules.
4. Make research delivery finalization return acceptance proof.

### Verification

```bash
npx vitest run tests/unit/familyAudit.test.ts tests/integration/phase15-research-verifier-accept.test.ts tests/integration/phase15-research-verifier-reject.test.ts
```

## Task 3: Browser Verifier Flow

### Objective

Add browser-specific audit logic that can accept, revise, or reject browser deliveries.

### Deliverables

- browser family audit function
- findings for:
  - outcome mismatch
  - exhausted recovery
  - invalid run-summary artifact
  - invalid steps artifact
- acceptance proof for browser deliveries

### Files

- `src/runtime/familyAudit.ts`
- `src/runtime/browserWorkflow.ts`
- `tests/integration/phase15-browser-verifier-accept.test.ts`
- `tests/integration/phase15-browser-verifier-revise.test.ts`
- `tests/integration/phase15-browser-verifier-reject.test.ts`

### TDD Steps

1. Add failing tests for accepted browser delivery.
2. Add failing tests for revise when outcome mismatch is recoverable.
3. Add failing tests for reject when recovery is exhausted or proof artifacts are invalid.
4. Implement browser audit rules and acceptance proof generation.

### Verification

```bash
npx vitest run tests/integration/phase15-browser-verifier-accept.test.ts tests/integration/phase15-browser-verifier-revise.test.ts tests/integration/phase15-browser-verifier-reject.test.ts
```

## Task 4: Verifier Enforcement In Runtime And Evaluator

### Objective

Make the verifier an enforced acceptance boundary instead of a sidecar annotation.

### Deliverables

- evaluator consumes acceptance proof
- runtime blocks final handoff unless verifier returns `accept`
- revise path receives verifier findings
- reject path becomes user-visible blocked state

### Files

- `src/eval/evaluator.ts`
- `src/core/orchestrator.ts`
- `src/runtime/executor.ts`
- `tests/unit/evaluator.test.ts`
- `tests/unit/orchestrator-autonomous-loop.test.ts`
- `tests/unit/runtime-executor.test.ts`

### TDD Steps

1. Add failing tests proving `completed delivery + reject proof` does not complete the task.
2. Add failing tests proving `revise` findings are carried forward into the next revision round.
3. Implement acceptance-proof enforcement in evaluator/orchestrator/executor.

### Verification

```bash
npx vitest run tests/unit/evaluator.test.ts tests/unit/orchestrator-autonomous-loop.test.ts tests/unit/runtime-executor.test.ts
```

## Task 5: Product Surface For Acceptance Proof

### Objective

Expose verifier decision, findings, and acceptance summary in the dashboard and inspection APIs.

### Deliverables

- `runtimeInspector` exposes:
  - verifier decision
  - verifier summary
  - findings count
  - findings preview
- dashboard lifecycle panel renders acceptance proof
- user-facing explanations mention acceptance/rejection semantics

### Files

- `src/runtime/taskLifecycle.ts`
- `ui/components/TaskLifecyclePanel.tsx`
- `ui/hooks/eventStreamState.ts`
- `ui/store/useTaskStore.ts`
- `tests/unit/taskLifecycle.test.ts`
- `tests/unit/ui-event-stream-state.test.ts`
- `tests/unit/ui-task-store.test.ts`

### TDD Steps

1. Add failing inspection tests for verifier data.
2. Add failing UI/store tests for accepted vs rejected summaries.
3. Implement acceptance-proof presentation.

### Verification

```bash
npx vitest run tests/unit/taskLifecycle.test.ts tests/unit/ui-event-stream-state.test.ts tests/unit/ui-task-store.test.ts
cd ui && npx tsc --noEmit
```

## Task 6: Release-Grade Proofs And Documentation

### Objective

Close the phase with end-to-end proofs, docs, and release prep.

### Deliverables

- README update
- changelog update
- handoff doc
- release diary
- Phase 15 gold-path proof suite

### Files

- `README.md`
- `CHANGELOG.md`
- `docs/phase-handoff-playbook/2026-04-09-phase15-qa-verifier-harness-handoff.md`
- `diary/2026-04-09-v1.2.0.md`

### Final Verification

```bash
npx vitest run tests/unit/qaFindings.test.ts tests/unit/familyAudit.test.ts tests/unit/evaluator.test.ts tests/unit/orchestrator-autonomous-loop.test.ts tests/unit/runtime-executor.test.ts tests/unit/taskLifecycle.test.ts tests/unit/ui-event-stream-state.test.ts tests/unit/ui-task-store.test.ts tests/integration/phase15-research-verifier-accept.test.ts tests/integration/phase15-research-verifier-reject.test.ts tests/integration/phase15-browser-verifier-accept.test.ts tests/integration/phase15-browser-verifier-revise.test.ts tests/integration/phase15-browser-verifier-reject.test.ts
cd ui && npx tsc --noEmit
```

## Recommended Execution Order

1. shared verifier contracts
2. research verifier
3. browser verifier
4. runtime enforcement
5. product surface
6. release proof and docs

## Success Criteria

Phase 15 is complete when:

- accepted delivery is structurally distinct from merely produced delivery
- verifier findings are typed and visible
- research/browser tasks can be accepted, revised, or rejected through verifier proof
- final user-facing completion depends on verifier acceptance
