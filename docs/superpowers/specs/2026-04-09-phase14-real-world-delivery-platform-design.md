# Phase 14 Real-World Delivery Platform Design

Date: 2026-04-09
Context: post-`v1.0.0` runtime kernel, distributed closure, agent intelligence kernel, and user productization

## Objective

Turn the current runtime kernel from a well-observed agent system into a real-world delivery platform that can reliably complete and hand off user-facing results for two task families:

- `research_writing`
- `browser_workflow`

This phase does not try to become a general browser/RPA platform or a benchmark-only harness. Its purpose is to make real tasks finish with trustworthy artifacts, verification, execution proof, and clear blocking diagnosis.

## Why Phase 14 Exists

After Phase 11-13, the project has:

- durable distributed execution
- context-native orchestration
- evaluator-led convergence
- planner policy enforcement
- retrieval and memory substrate
- productized runtime inspection

What is still missing is a task-family-aware delivery layer that turns runtime capability into dependable end-user outcomes.

Today the runtime can explain itself well. Phase 14 is about making it complete more real tasks well.

## Product Direction

Phase 14 intentionally uses different optimization goals for the two first-class task families:

- `research_writing`: optimize for high-trust delivery
- `browser_workflow`: optimize for high-automation execution

This difference is a design choice, not an inconsistency.

For research and writing tasks, the system should prefer blocking over hallucinated delivery.

For browser workflow tasks, the system should prefer automated execution and bounded recovery, while still leaving behind auditable execution proof.

## Scope

### In Scope

- task-family-aware delivery contracts
- run-proof generation
- family-aware verification contracts
- family-aware completion gates
- research retrieval, claim extraction, verification, and citation-aware writing
- browser session, step execution, result validation, and recovery
- dashboard and inspection surfaces for family-specific delivery truth
- family-specific gold paths and release-grade proof

### Out of Scope

- full browser platform or broad computer-use system
- full benchmark platform
- enterprise auth redesign
- broad UI redesign unrelated to delivery trust
- generalized office/RPA automation
- large vector database redesign

## Design Principles

1. Delivery is the product, not only execution.
2. Every task family has explicit completion rules.
3. Artifacts, verification, and run proof are first-class outputs.
4. Research tasks prefer trust over automation.
5. Browser tasks prefer automation over early blocking.
6. UI should expose delivery truth, not raw runtime fragments.

## Current Baseline

The runtime already has the pieces that Phase 14 can build on:

- `ExecutionContext`
- runtime executor and task lifecycle control plane
- policy-aware orchestration
- evaluator-led completion and blocking
- memory/retrieval enrichment
- queue-backed async execution
- dashboard runtime inspector
- artifact existence and non-empty checks

Phase 14 should extend these, not bypass them.

## Primary Task Families

### 1. `research_writing`

Purpose:

- investigate external or repository-backed sources
- extract validated claims
- compose a user-facing written deliverable

Primary optimization target:

- trustworthiness

Required delivery properties:

- source-backed claims
- verification evidence
- article artifact
- final references artifact
- clear blocking if trust requirements are not met

### 2. `browser_workflow`

Purpose:

- navigate websites or web apps
- perform structured actions such as filling forms, clicking, selecting, submitting, or checking outcomes

Primary optimization target:

- automated execution reliability

Required delivery properties:

- explicit executed-step trace
- final browser outcome validation
- recoverable retry model
- run summary artifact
- blocking only after bounded recovery is exhausted

## Core Architecture

Phase 14 introduces a shared layer plus two task-family-specific stacks.

### Shared Layer: Real-World Delivery Harness

Responsibilities:

- task family contract
- delivery proof contract
- verification contract
- family-aware completion gates
- family-aware failure taxonomy
- inspection payloads for product surfaces

### Task-Family Stack: Research Writing

Responsibilities:

- source retrieval
- source extraction
- claim normalization
- claim verification
- citation-aware composition
- trust-first final audit

### Task-Family Stack: Browser Workflow

Responsibilities:

- browser session handling
- page understanding
- step planning
- action execution
- outcome validation
- bounded recovery

## Proposed Contracts

### Task Family

```ts
type TaskFamily =
  | "research_writing"
  | "browser_workflow";
```

### Task Family Policy

```ts
type TaskFamilyPolicy = {
  family: TaskFamily;
  automationPriority: "high" | "medium" | "low";
  trustPriority: "high" | "medium" | "low";
  requireVerification: boolean;
  requireArtifacts: boolean;
  browserRecoveryBudget?: number;
  sourceCoverageMinimum?: number;
};
```

### Verification Record

```ts
type VerificationRecord = {
  kind: "source" | "page_state" | "form_result" | "artifact_check";
  summary: string;
  sourceId?: string;
  locator?: string;
  passed: boolean;
};
```

### Delivery Proof

```ts
type DeliveryProof = {
  family: TaskFamily;
  steps: Array<{
    kind: string;
    status: "completed" | "failed" | "blocked";
    summary: string;
    evidenceRefs?: string[];
  }>;
  replayHints?: string[];
};
```

### Family-Aware Delivery Result

```ts
type FamilyDeliveryBundle = {
  status: "completed" | "blocked" | "failed" | "partial";
  family: TaskFamily;
  finalResult: string;
  artifacts: string[];
  verification: VerificationRecord[];
  deliveryProof: DeliveryProof;
  blockingReason?: string;
  nextActions?: string[];
};
```

These contracts should be layered on top of the current delivery bundle, not introduced as a parallel runtime.

## Research Writing Design

### Flow

1. `retrieve_sources`
2. `extract_claims`
3. `verify_claims`
4. `compose_article`
5. `final_audit`

### Step Details

#### `retrieve_sources`

The runtime gathers candidate sources using:

- web search
- page fetch
- repository-aware retrieval
- existing retrieval context

Output:

- normalized source set
- source previews
- retrieval trace

#### `extract_claims`

The runtime converts retrieved material into structured candidate claims.

Each claim should contain:

- concise statement
- source references
- confidence hint
- whether the claim is critical to the final article

#### `verify_claims`

The runtime verifies claims against source material.

Rules:

- critical claims must be source-backed
- weak or unsupported claims must be excluded from the article body
- unverifiable critical claims block final delivery

#### `compose_article`

The writer composes final copy using verified claims only.

Outputs should include:

- article body
- title and summary
- references appendix or structured references artifact

#### `final_audit`

The final audit checks:

- article artifact exists and is non-empty
- verification exists
- critical claim coverage meets minimum threshold
- final copy does not depend on unverified claims

### Research Artifacts

Minimum required:

- `final.md`
- `references.json`
- `delivery.json`

Optional:

- `outline.md`
- `claims.json`

### Research Blocking Rules

Block when:

- verification is missing
- critical claims are unverified
- article artifact is missing or empty
- available sources are insufficient for a trustworthy article

### Research Success Criteria

- article is source-backed
- references are inspectable
- verification preview is visible in the UI
- deliverable can be handed to a user without pretending uncertainty is confidence

## Browser Workflow Design

### Flow

1. `open_session`
2. `understand_page`
3. `plan_steps`
4. `execute_steps`
5. `validate_outcome`
6. `finalize_run`

### Step Details

#### `open_session`

The runtime opens a browser context and captures initial page facts.

#### `understand_page`

The runtime extracts:

- URL
- page title
- visible actions
- form fields
- login state hints

This creates a page snapshot that later steps can reason over.

#### `plan_steps`

The runtime turns the user goal into explicit action steps.

Each step should describe:

- target
- action
- expected result

#### `execute_steps`

The runtime performs browser actions such as:

- click
- type
- select
- submit
- wait

Each step should emit a before/after execution record.

#### `validate_outcome`

The runtime confirms whether the expected page or workflow outcome was reached.

This is not the same as “the browser command returned successfully”.

#### `finalize_run`

The runtime produces:

- final result summary
- run proof
- failure explanation if needed
- recovery suggestion if incomplete

### Browser Artifacts

Minimum required:

- `run-summary.md`
- `steps.json`
- `delivery.json`

Optional:

- `page-final.html`
- `screenshots/`
- `form-submission-proof.json`

### Browser Blocking Rules

Block when:

- required target cannot be located after bounded retries
- authentication or prerequisite state is missing
- expected outcome is not reached after recovery budget is exhausted

### Browser Success Criteria

- workflow completes automatically where possible
- executed steps are inspectable
- final page/result state is validated
- blocked runs explain exactly where recovery stopped

## Shared Failure Taxonomy

Phase 14 should add delivery-family-aware failure classes such as:

- `source_insufficient`
- `claim_unverified`
- `citation_missing`
- `browser_target_missing`
- `browser_action_failed`
- `browser_outcome_not_reached`
- `browser_recovery_exhausted`

These should feed:

- delivery gating
- task lifecycle inspection
- UI explanation surfaces
- release proof tests

## Runtime Changes Needed

### New Components

- `taskFamilyClassifier`
- `taskFamilyPolicyBuilder`
- `deliveryProofBuilder`
- `familyAwareEvaluator`
- `researchClaimVerifier`
- `browserRunRecorder`

### Existing Components To Extend

- `runtime executor`
  - select task family
  - choose family policy
  - route to family-aware execution paths
- `orchestrator`
  - apply family-aware completion rules
- `taskLifecycle.inspectTask()`
  - expose delivery proof and family-specific inspection data
- `TaskLifecyclePanel`
  - expose family-specific delivery truth
- artifact archiving
  - support family-specific bundles

## UI and Product Surface

Phase 14 should extend the existing runtime inspector instead of replacing it.

### Research Inspector Additions

- source coverage
- verified claim count
- references preview
- trust-oriented blocking explanation

### Browser Inspector Additions

- executed step count
- last successful step
- validation result
- recovery attempts
- automation-oriented blocking explanation

### Shared UI Expectations

- final result remains visible
- artifacts show existence and non-empty truth
- verification preview remains inspectable
- run proof is visible as a user-facing summary, not only as low-level logs

## Delivery and Recovery Policy

### Research Recovery

Preferred order:

1. find better sources
2. re-verify critical claims
3. recompose final article

Research recovery should not skip verification to force delivery.

### Browser Recovery

Preferred order:

1. retry step
2. re-locate target
3. reload page
4. continue from last stable point

Browser recovery should be bounded by policy, not open-ended.

## Testing Strategy

Phase 14 should be proof-driven, not unit-test-only.

### Research Gold Paths

- successful verified article delivery
- blocked article due to insufficient or unverifiable sources

### Browser Gold Paths

- successful browser/form completion with run proof
- blocked browser workflow with clear failure and recovery explanation

### Shared Assertions For All Gold Paths

- final delivery bundle exists
- artifact truth is visible
- verification truth is visible where required
- inspection explains success or blocking in user terms
- action hints are meaningful

## Recommended Implementation Order

1. shared family-aware delivery harness
2. research-writing stack
3. browser workflow stack
4. product surface and proof tightening

This order keeps the architecture shared while ensuring the higher-trust task family shapes the delivery contracts first.

## Risks

- making browser delivery too automation-heavy without enough evidence
- allowing research delivery to look complete without sufficient verification
- introducing family-specific branches that bypass the shared runtime kernel
- turning the product inspector back into a debug console instead of a delivery surface

## Success Criteria

Phase 14 is successful when:

- `research_writing` delivers source-backed, inspectable written artifacts
- `browser_workflow` delivers automated, replayable execution summaries with bounded recovery
- family-aware delivery truth is visible in the UI
- blocked tasks explain what failed and what should happen next
- the runtime becomes more useful in real user work, not only more architecturally complete

## Recommended Next Step

After this spec is approved, create the implementation plan in `docs/superpowers/plans/` with tasks for:

1. family-aware contracts and delivery harness
2. research-writing trust pipeline
3. browser workflow automation pipeline
4. product-surface integration
5. release-grade verification
