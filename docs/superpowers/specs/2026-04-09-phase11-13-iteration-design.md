# Phase 11-13 Iteration Design

Date: 2026-04-09
Context: post-`0.7.0` runtime kernel and lifecycle async control plane

## Objective

Continue the runtime evolution in three ordered phases:

- `Phase 11`: Distributed execution closure
- `Phase 12`: Agent intelligence kernel
- `Phase 13`: User-facing productization

The sequencing is intentional:

1. make the system durable across workers and processes
2. make the runtime more autonomous and better at convergence
3. make the resulting behavior legible and trustworthy to users

## Current Baseline

As of `0.7.0`, the project already has:

- runtime executor and task lifecycle control plane
- context-native orchestrator
- policy enforcement and evaluator-guided convergence
- retrieval/memory enrichment and task-scoped write-back
- resume/replay with memory restore
- queue-backed parallel execution entrypoint
- worker async callback events
- dashboard/API lifecycle endpoints
- task-level and node-level async feedback in the UI

What is still missing is the final closure for distributed durability, deeper agentic reasoning control, and a product-level runtime inspector and delivery UX.

## Phase 11: Distributed Closure

### Goal

Turn the current async and queue-backed runtime from a shared entrypoint foundation into a truly durable distributed execution system.

### Scope

- worker ownership for queued tasks/nodes
- dedupe semantics for lifecycle jobs and node jobs
- shared persistence updates from queued node completion
- distributed join state and multi-worker coordination
- durable replay after worker interruption
- retry semantics aligned with shared task graph state

### Deliverables

- queue-backed node execution writes node results back into the shared task graph
- queue-backed task execution updates graph/task lifecycle state without relying only on transient events
- ownership metadata on queued jobs
- dedupe rules for:
  - same task lifecycle request
  - same queued node re-dispatch
- join state that survives process restart
- distributed-safe replay policy

### Success Criteria

- queued node completion is visible in persistence even if the original caller disappears
- repeated enqueue of the same node does not create inconsistent duplicate execution
- task restart after worker failure can resume from persisted distributed state
- async execution is no longer “event-rich but persistence-light”

### Risks

- subtle race conditions between worker callback and local orchestrator expectations
- graph corruption if dedupe and ownership are not explicit
- accidental divergence between local and queue execution paths

## Phase 12: Agent Intelligence Kernel

### Goal

Make the runtime more agentic in a principled way by deepening convergence control, planner authority, and capability-aware execution.

### Scope

- unified prompt pipeline
- evaluator as the sole convergence authority
- invalid-output taxonomy
- richer planner policy enforcement
- tighter capability/tool/memory/retrieval linkage
- typed join/revise/spawn decisions

### Deliverables

- one production prompt path driven by `ExecutionContext`
- invalid-output classes such as:
  - `empty_delivery`
  - `invalid_protocol`
  - `semantic_tool_loop`
  - `verification_missing`
  - `policy_tool_not_allowed`
- evaluator outputs expanded to typed runtime decisions
- planner policy enforced beyond tool gating:
  - verification requirements
  - allowed capabilities
  - revise bounds
  - delivery constraints
- join contract for:
  - `deliver`
  - `revise_child`
  - `spawn_more`
  - `block`

### Success Criteria

- orchestrator never completes a node without evaluator agreement
- planner policy changes execution behavior structurally, not only via prompt hints
- recovery from malformed model output is explicit and typed
- tree/multi-agent execution becomes more stable across free-model variance

### Risks

- overfitting runtime policy to current model quirks
- making evaluator too aggressive and harming throughput
- prompt unification causing regressions in existing working flows

## Phase 13: User Productization

### Goal

Turn the stronger runtime into a user-trustworthy product layer where task state, reasoning path, evidence, and final delivery are understandable and actionable.

### Scope

- dashboard runtime inspector
- lifecycle actions and feedback refinement
- artifact and verification presentation
- final-result explanation surfaces
- gold-path demos and user-facing proof
- task closure and blocking diagnosis UX

### Deliverables

- dashboard sections for:
  - intent
  - plan
  - policy
  - active node path
  - join decisions
  - final delivery
  - verification evidence
- improved artifact view with file existence and non-empty status surfaced
- clearer blocked/failed explanations at task and node level
- gold-path demo flows for:
  - research-writing
  - code edit and test
  - async resume after interruption
- lifecycle controls with explicit success/failure responses

### Success Criteria

- a user can understand not only what happened, but why the runtime made a decision
- blocked tasks return actionable explanations instead of opaque JSON states
- artifact delivery is inspectable and trustworthy from the UI
- demos prove the runtime end-to-end instead of only through tests

### Risks

- UI grows into a debug console instead of a product surface
- too much observability detail overwhelms users
- runtime facts and UI summaries drift if contracts are not shared

## Recommended Execution Order

1. `Phase 11`
2. `Phase 12`
3. `Phase 13`

This order should be preserved unless a specific user-facing production need forces selective `Phase 13` work earlier.

## Boundaries

These phases should stay focused and avoid scope creep into:

- enterprise auth redesign
- full browser automation platform work
- broad UI redesign unrelated to runtime legibility
- large marketplace/ecosystem expansion work

## Exit Criteria

The post-`0.7.0` iteration wave is successful when:

- distributed async execution is durable and replayable
- evaluator and planner policy truly govern autonomous convergence
- dashboard and delivery UX expose runtime truth clearly to users

