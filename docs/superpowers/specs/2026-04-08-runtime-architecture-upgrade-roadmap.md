# Runtime Architecture Upgrade Roadmap

Date: 2026-04-08
Target line: post-`0.5.1` phased architecture upgrade

## Objective

Move the project from a CLI-led autonomous demo runtime to a clear, reusable runtime kernel where:

- CLI, UI, API, worker, and replay all call the same runtime service
- intent, planning, policy, context, evaluation, and delivery are first-class contracts
- planner output affects real execution policy, not only prompt text
- tree/multi-agent execution is owned by the orchestrator, not by entrypoint glue
- future memory, RAG, capability routing, async workers, and team agents can attach without redesign

## Current State

The project now has a workable base:

- structured tool-call loop
- delivery gating and artifact validation
- intent classification
- planner-expanded child workflow
- planner policy injection into node prompts
- execution context base object
- dashboard event stream and graph rendering

But the architecture still has critical coupling:

- `runTask` still owns too much execution logic
- orchestrator still executes prompt-shaped inputs instead of `ExecutionContext`
- planner policy is advisory, not runtime-enforced
- prompt pipeline is split between old and new protocols
- capability routing, memory, and async recovery are not first-class

## Design Principles

1. One runtime kernel, many entrypoints
2. Contracts over ad hoc payloads
3. Planner policy must be enforceable
4. Evaluator must own convergence
5. UI observes runtime facts, not reconstructed guesses
6. Memory and RAG attach to `ExecutionContext`, not to prompts directly

## Phase 1: Runtime Core Consolidation

Goal: move control flow out of CLI and into runtime services.

Deliverables:

- `src/runtime/contracts.ts`
  - `TaskIntent`
  - `ExecutionPlan`
  - `PlanNodeSpec`
  - `ExecutionPolicy`
  - `ExecutionContext`
- `src/runtime/executor.ts`
  - one service that owns classify -> plan -> execute -> finalize
- `runTask.ts` reduced to CLI argument parsing + executor invocation
- event model updated so executor publishes canonical lifecycle events

Success criteria:

- CLI no longer contains planning or workflow-construction logic
- one executor can be reused by CLI, HTTP API, worker, and replay

## Phase 2: Orchestrator Becomes Context-Native

Goal: make orchestrator operate on `ExecutionContext`, not free-form `runtimeInput`.

Deliverables:

- `orchestrator.runNode(context)`
- `runParallelTask` accepts plan nodes plus context
- persistence stores context metadata and dependency lineage
- resume reconstructs context before re-execution

Success criteria:

- node execution can be resumed without recreating prompts from scratch
- dependency outputs, planner policy, and intent survive restart

## Phase 3: Planner Policy Enforcement

Goal: move planner output from prompt hinting to runtime-enforced behavior.

Deliverables:

- capability registry above tool registry
- policy-aware tool router
- evaluator consumes `completionPolicy`
- verification policy enforced before stop/deliver
- optional tool allowlist / denylist support

Success criteria:

- planner can constrain what tools are preferred or permitted
- evaluator stop/block decisions are derived from policy, not only model text

## Phase 4: Unified Prompt Pipeline

Goal: replace split prompt logic with one composable prompt system.

Deliverables:

- deprecate legacy graph prompt protocol
- `promptComposer` consumes `ExecutionContext`
- role-specific prompt fragments
- planner/evaluator prompt schemas versioned

Success criteria:

- there is one production prompt path
- planner, researcher, writer, and evaluator all share the same runtime contracts

## Phase 5: Evaluator-Led Convergence

Goal: evaluator becomes the single authority for continue/revise/stop/block/escalate.

Deliverables:

- explicit `NodeOutcome` and `TaskOutcome`
- invalid output classes
  - `empty_delivery`
  - `invalid_protocol`
  - `semantic_tool_loop`
  - `verification_missing`
- join evaluation contract
- bounded revise and semantic retry policy

Success criteria:

- orchestrator never marks a node complete before evaluator agreement
- join logic can revise specific children or spawn more work in a typed way

## Phase 6: Memory and RAG Foundation

Goal: attach long-running context to execution without bloating prompts.

Deliverables:

- working memory summaries
- task memory snapshots
- retrieval memory refs on `ExecutionContext`
- embedding-backed document retrieval

Success criteria:

- long tasks can resume with useful context
- research/code tasks can retrieve relevant prior evidence instead of repeating search

## Phase 7: Capability-Native Tooling

Goal: abstract tools as capabilities for better planning and policy.

Deliverables:

- capability registry
  - `research`
  - `verification`
  - `filesystem`
  - `code_edit`
  - `test`
  - `browser`
  - `publish`
- capability-to-tool resolution
- planner outputs target capabilities first, tools second

Success criteria:

- planner does not need to know concrete tool names for most tasks
- model/tool upgrades do not force planner schema changes

## Phase 8: Async and Distributed Execution

Goal: make autonomous tasks durable across workers and processes.

Deliverables:

- executor-compatible queue worker
- callback/result ingestion
- context-aware retry/replay
- distributed join state

Success criteria:

- the same task can continue after worker restart
- async agents preserve policy, context, and audit semantics

## Phase 9: Runtime Observability Upgrade

Goal: move from event viewer to true runtime inspector.

Deliverables:

- structured event payloads for intent, plan, policy, join, evaluation
- dashboard sections for:
  - intent
  - planner policy
  - active context
  - join decisions
  - final delivery
- tree trace with node path and execution timings

Success criteria:

- dashboard can explain why the runtime made a decision, not only what event fired

## Phase 10: API and Entry Surface Unification

Goal: support CLI, dashboard, worker, and future HTTP/API with the same runtime contract.

Deliverables:

- `executor.run(taskRequest)`
- CLI adapter
- dashboard adapter
- worker adapter
- future API adapter

Success criteria:

- no business logic divergence between CLI and non-CLI entrypoints

## Recommended Execution Order

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5
6. Phase 6
7. Phase 7
8. Phase 8
9. Phase 9
10. Phase 10

## Non-Goals For The First Upgrade Wave

- full enterprise auth redesign
- complete team-agent social protocol
- rich browser automation layer
- final visual polish for dashboard

These are valuable, but they should not block runtime-core consolidation.

## Exit Criteria For The Architecture Upgrade

The architecture upgrade is successful when:

- orchestrator is context-native
- planner policy is runtime-enforced
- evaluator owns convergence
- CLI is only an adapter
- dashboard reflects runtime contracts directly
- async execution and resume preserve context and policy
