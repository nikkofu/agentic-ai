# Phase 15 QA / Verifier Harness Design

Date: 2026-04-09
Context: post-`v1.1.0` real-world delivery platform with family-aware delivery harness for `research_writing` and `browser_workflow`

## Objective

Turn the current delivery platform into a verifier-led system that can independently audit, reject, request revisions, and prove acceptance criteria before user-facing handoff.

Phase 15 is about making the runtime not only *produce* outputs, but also *distrust and verify* them in a structured way.

## Why Phase 15 Exists

After Phase 14, the project can:

- deliver family-aware artifacts
- show artifact truth and verification previews
- distinguish trust-first research from automation-first browser workflows
- explain blocked or completed outcomes in user-facing language

What is still missing is a stronger acceptance boundary.

Today the runtime can produce and inspect a delivery. Phase 15 should make it able to *challenge* that delivery before handing it off.

## Core Product Goal

Introduce a first-class verifier layer that can:

- re-check runtime outputs
- run family-aware audits
- emit findings
- trigger targeted revision
- accept or reject delivery

The runtime should increasingly behave like:

1. planner produces work
2. worker produces artifacts
3. verifier audits artifacts
4. evaluator decides accept / revise / reject

## Scope

### In Scope

- verifier role and contracts
- QA findings schema
- family-aware verification audits
- verifier-aware revise loop
- explicit acceptance decision boundary
- UI inspection of verifier findings and acceptance proof
- release-grade proofs for accepted and rejected deliveries

### Out of Scope

- benchmark platform redesign
- broad multi-tenant review workflow
- human approval marketplace
- generalized lint/test farm orchestration
- large browser platform redesign

## Design Principles

1. Verification is an independent runtime responsibility.
2. Acceptance and production should be structurally separated.
3. Verifier findings must be typed, not free-form commentary only.
4. A blocked or rejected delivery is better than a false-positive acceptance.
5. The verifier should be family-aware but contract-consistent.
6. UI should show *why* a delivery was accepted or rejected.

## Positioning Relative To Existing Runtime

Phase 15 should build on top of:

- task-family-aware delivery harness
- planner policy enforcement
- evaluator-led convergence
- runtime inspector
- distributed execution and resume/replay

It should not create a separate “review system” outside the runtime. Verifier is a role inside the same kernel.

## Primary Architecture

Phase 15 introduces a new shared layer:

### Shared Layer: QA / Verifier Harness

Responsibilities:

- define verifier contracts
- normalize findings
- run acceptance audits
- request targeted revision
- publish acceptance proof

This shared layer is consumed by task families:

- `research_writing`
- `browser_workflow`

## Proposed Contracts

### Verifier Decision

```ts
type VerifierDecision =
  | "accept"
  | "revise"
  | "reject";
```

### QA Finding

```ts
type QaFinding = {
  severity: "critical" | "major" | "minor";
  kind:
    | "verification_gap"
    | "claim_risk"
    | "artifact_invalid"
    | "browser_outcome_mismatch"
    | "browser_recovery_exhausted"
    | "policy_violation";
  summary: string;
  evidenceRefs?: string[];
  nodeId?: string;
};
```

### Acceptance Proof

```ts
type AcceptanceProof = {
  decision: VerifierDecision;
  acceptedAt?: number;
  findings: QaFinding[];
  verifierSummary: string;
};
```

### Family Audit Input

```ts
type FamilyAuditInput = {
  family: "research_writing" | "browser_workflow";
  delivery: FamilyDeliveryBundle;
  artifacts: Array<{
    path: string;
    exists: boolean;
    nonEmpty: boolean;
  }>;
};
```

## Research Verification Design

### Goal

Reject articles that look polished but are not adequately grounded.

### Verifier Checks

- source coverage meets minimum
- critical claims have source references
- references artifact exists and is non-empty
- final article artifact exists and is non-empty
- verification records are consistent with references

### Typical Findings

- `verification_gap`
- `claim_risk`
- `artifact_invalid`

### Acceptance Rule

Research delivery is accepted only if:

- no critical findings
- source coverage threshold is satisfied
- article and references artifacts are valid

Otherwise:

- `revise` if repairable
- `reject` if evidence is fundamentally insufficient

## Browser Workflow Verification Design

### Goal

Accept automation only when the desired page outcome was actually reached.

### Verifier Checks

- final validation step exists
- validation summary indicates success
- run-summary artifact exists and is non-empty
- steps artifact exists and is non-empty
- recovery attempts did not exceed policy

### Typical Findings

- `browser_outcome_mismatch`
- `browser_recovery_exhausted`
- `artifact_invalid`

### Acceptance Rule

Browser workflow is accepted only if:

- outcome validation passed
- execution proof artifacts are valid
- no critical browser findings remain

Otherwise:

- `revise` if a bounded retry path exists
- `reject` if recovery budget is exhausted or outcome is irrecoverably wrong

## Runtime Changes

### New Modules

- `src/runtime/verifier.ts`
- `src/runtime/qaFindings.ts`
- `src/runtime/familyAudit.ts`

### Existing Modules To Extend

- `src/eval/evaluator.ts`
  - incorporate verifier acceptance proof
- `src/core/orchestrator.ts`
  - verifier pass before final delivery acceptance
- `src/runtime/taskLifecycle.ts`
  - expose verifier findings and acceptance proof
- `ui/components/TaskLifecyclePanel.tsx`
  - show acceptance / rejection / revise findings

## Delivery State Model

Phase 15 should make a distinction between:

- produced delivery
- accepted delivery

This means a task may have:

- `delivery.status = completed`
- but `acceptanceProof.decision = revise`

The final user-facing task state should only become truly complete when acceptance is `accept`.

## UI and Product Surface

The runtime inspector should gain:

- verifier decision
- findings count by severity
- verifier summary
- acceptance proof preview

### Research UI Additions

- trust audit result
- source adequacy summary
- references artifact audit result

### Browser UI Additions

- outcome audit result
- recovery budget summary
- execution-proof audit result

## Failure and Recovery Model

### Verifier-Led Revise

When the verifier returns `revise`, the runtime should:

- preserve findings
- attach findings to the next revision prompt
- avoid generic retry loops

### Verifier-Led Reject

When the verifier returns `reject`, the runtime should:

- block final handoff
- expose findings in inspection
- provide family-aware next steps

## Testing Strategy

Phase 15 should be proof-driven.

### Research Proofs

- accepted verified article
- revise due to insufficient reference coverage
- reject due to invalid/missing reference artifact

### Browser Proofs

- accepted successful browser workflow
- revise due to recoverable outcome mismatch
- reject due to exhausted recovery or invalid execution proof

### Shared Assertions

- acceptance proof exists
- verifier findings are visible
- accepted tasks expose verifier summary
- revised or rejected tasks expose actionable findings

## Recommended Implementation Order

1. shared verifier contracts and finding taxonomy
2. research verifier flow
3. browser verifier flow
4. product surface for acceptance proof
5. release-grade proofs and docs

## Risks

- verifier becomes too weak and only repeats evaluator behavior
- verifier becomes too strict and blocks nearly everything
- acceptance proof is generated but not actually enforced
- UI regresses into low-level debug output instead of acceptance clarity

## Success Criteria

Phase 15 is successful when:

- the runtime can distinguish produced delivery from accepted delivery
- verifier findings are structured and visible
- research outputs can be revised or rejected based on trust findings
- browser workflows can be revised or rejected based on outcome findings
- accepted handoff is backed by an explicit acceptance proof
