# Phase 15 QA / Verifier Harness Handoff

Date: 2026-04-09
Branch: `phase15-qa-verifier-harness`
Scope: make final handoff depend on verifier acceptance rather than only produced delivery

## Completed

- added shared verifier contracts:
  - `VerifierDecision`
  - `QaFinding`
  - `AcceptanceProof`
- added `qaFindings` normalization helpers
- added `familyAudit` for:
  - `research_writing`
  - `browser_workflow`
- executor now enforces verifier acceptance before final completion
- runtime inspector now exposes:
  - acceptance decision
  - verifier summary
  - findings count
  - findings preview
- dashboard lifecycle panel now shows verifier proof data

## Verification

Focused Phase 15 suite:

```bash
npx vitest run tests/unit/qaFindings.test.ts tests/unit/familyAudit.test.ts tests/unit/evaluator.test.ts tests/unit/runtime-executor.test.ts tests/unit/taskLifecycle.test.ts tests/unit/ui-event-stream-state.test.ts tests/integration/phase15-research-verifier-accept.test.ts tests/integration/phase15-research-verifier-reject.test.ts tests/integration/phase15-browser-verifier-accept.test.ts tests/integration/phase15-browser-verifier-revise.test.ts tests/integration/phase15-browser-verifier-reject.test.ts
```

UI type verification:

```bash
cd ui && npx tsc --noEmit
```

## Key Files

- `src/runtime/contracts.ts`
- `src/runtime/qaFindings.ts`
- `src/runtime/familyAudit.ts`
- `src/runtime/executor.ts`
- `src/runtime/taskLifecycle.ts`
- `ui/components/TaskLifecyclePanel.tsx`

## Recommended Next Step

- merge Phase 15 to `main`
- release a new version
- use verifier acceptance proof as the base for future benchmark or completion-rate phases
