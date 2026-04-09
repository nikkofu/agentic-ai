# Phase 14 Real-World Delivery Platform Plan

Date: 2026-04-09
Goal: turn the runtime kernel into a real-world delivery platform for two first-class task families:
- `research_writing`
- `browser_workflow`

## Task 1: Shared Task-Family Contracts + Delivery Harness

Status: completed

Delivered:
- shared task family contracts
- family-aware delivery bundles and proof records
- family policy normalization and completion gates

Key files:
- `src/runtime/contracts.ts`
- `src/runtime/taskFamily.ts`
- `src/runtime/deliveryHarness.ts`
- `src/runtime/executor.ts`

Verification:
- `tests/unit/taskFamily.test.ts`
- `tests/unit/deliveryHarness.test.ts`
- `tests/unit/runtime-executor.test.ts`

## Task 2: Research-Writing Trust Pipeline

Status: completed

Delivered:
- distinct source coverage accounting
- `references.json` artifact generation
- research-specific delivery finalization
- research gold-path and blocked-path proof

Key files:
- `src/runtime/researchWriting.ts`
- `src/tools/researchTools.ts`
- `src/runtime/taskLifecycle.ts`

Verification:
- `tests/unit/researchTools.test.ts`
- `tests/unit/researchWriting.test.ts`
- `tests/integration/phase14-research-writing-gold-path.test.ts`
- `tests/integration/phase14-research-writing-blocked.test.ts`

## Task 3: Browser-Workflow Automation Pipeline

Status: completed

Delivered:
- local browser workflow tools
- browser run-proof summarization
- browser success and blocked-path proof
- browser-aware lifecycle inspection data

Key files:
- `src/tools/browserTools.ts`
- `src/runtime/browserWorkflow.ts`
- `src/runtime/runtimeServices.ts`
- `src/runtime/taskLifecycle.ts`

Verification:
- `tests/unit/browserTools.test.ts`
- `tests/unit/browserWorkflow.test.ts`
- `tests/integration/phase14-browser-workflow-gold-path.test.ts`
- `tests/integration/phase14-browser-workflow-blocked.test.ts`

## Task 4: Family-Aware Product Surface

Status: completed

Delivered:
- family-specific runtime inspector fields
- family-specific explanations and action hints
- lifecycle panel sections for research/browser proof

Key files:
- `src/runtime/taskLifecycle.ts`
- `ui/components/TaskLifecyclePanel.tsx`

Verification:
- `tests/unit/taskLifecycle.test.ts`
- `tests/integration/phase14-research-writing-gold-path.test.ts`
- `tests/integration/phase14-research-writing-blocked.test.ts`
- `tests/integration/phase14-browser-workflow-gold-path.test.ts`
- `tests/integration/phase14-browser-workflow-blocked.test.ts`

## Task 5: Release-Grade Verification And Docs

Status: completed

Delivered:
- README and changelog updates
- Phase 14 handoff
- release diary
- version bump for release

Release verification:
- focused Phase 14 suite
- `ui` type-check

## Release Gate

Phase 14 is ready to release when:
- research-writing and browser-workflow gold paths both pass
- blocked-path proofs both pass
- lifecycle inspection exposes family-aware truth
- `ui` type-check passes
