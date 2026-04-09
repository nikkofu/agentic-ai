# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
### Changed
- **Phase 16 Closure**: Wired default runtime memory and Dream inspectors so the dashboard now shows live memory and Dream summaries without test-only injection.
- **Auto-Curation Pipeline**: Added automatic project-memory curation and compression after successful execution, plus explicit demote/forget support in the memory engine.
- **Dream Idle Trigger**: Added a safe Dream scheduler that runs idle reflection only after the configured threshold and never performs external actions.
- **Memory Product Truth**: Added de-duplicated memory injection ordering, empty-state messaging, and Dream freshness signals in the dashboard memory surface.

## [1.3.2] - 2026-04-09
### Changed
- **Release Diary Refinement**: Refined the `v1.3.1` diary entry to better match the intended quieter, more inward release-note voice and updated its music backdrop.

## [1.3.1] - 2026-04-09
### Changed
- **Release Diary Tone Update**: Refined the `v1.3.0` release diary toward a more reflective, relationship-aware INFJ-style voice while keeping the engineering facts intact.

## [1.3.0] - 2026-04-09
### Added
- **Phase 16 Memory Productization**: Added first-class `personal`, `project`, and `task` memory layers with markdown-first storage, JSON indexing, promotion, and retrieval primitives.
- **Layered Memory Engine**: Added a shared memory engine that writes task raw memory, project summaries, and supports promotion to curated/compressed states.
- **Bounded Memory Injection**: Added explicit memory injection ordering so personal/project compressed memory and task curated memory enter prompts ahead of raw task detail.
- **Dream Runtime**: Added an idle-time Dream runtime that generates reflections, hypotheses, recommendations, and skill drafts without performing external actions by default.
- **Memory Product Surface**: Added memory and Dream summaries to runtime inspection plus a dedicated dashboard `MemoryPanel`.

### Changed
- **Runtime Services Memory Wiring**: Runtime services now build the Phase 16 memory engine and Dream runtime instead of using the earlier task-only in-memory store.
- **Prompt Memory Rendering**: Prompt composition now uses explicit memory-injection output rather than ad hoc memory string assembly.

## [1.2.0] - 2026-04-09
### Added
- **Phase 15 QA / Verifier Harness**: Added shared verifier contracts, QA finding taxonomy, acceptance proof, and family-aware audit flow for `research_writing` and `browser_workflow`.
- **Research Verifier Flow**: Research deliveries can now be accepted, revised, or rejected based on source coverage, verification adequacy, and artifact validity.
- **Browser Verifier Flow**: Browser deliveries can now be accepted, revised, or rejected based on outcome validation, recovery state, and execution-proof artifacts.
- **Acceptance Proof Product Surface**: Runtime inspector and dashboard lifecycle panel now expose verifier decision, verifier summary, findings count, and findings preview.

### Changed
- **Verifier-Enforced Handoff**: Executor now treats verifier acceptance as a required boundary before final user-facing completion.
- **Acceptance-Aware Explanations**: Research and browser explanations now distinguish accepted, revised, and rejected states instead of only generic blocked/completed phrasing.

## [1.1.0] - 2026-04-09
### Added
- **Phase 14 Task Family Contracts**: Added shared `research_writing` and `browser_workflow` delivery contracts, family-aware policies, delivery proof bundles, and verification records.
- **Research Writing Trust Pipeline**: Added source-aware research finalization with distinct-source coverage, `references.json` artifacts, trust-oriented blocking, and research gold-path coverage.
- **Browser Workflow Automation Pipeline**: Added browser workflow tools, run-proof summarization, blocked/success browser proofs, and browser-aware inspection data.
- **Family-Aware Product Surface**: Runtime inspector and dashboard lifecycle panel now expose family-specific delivery truth, run-proof summaries, research trust signals, and browser execution signals.
- **Phase 13 Code Edit Gold Path**: Added a product-facing proof that completed code-edit tasks surface artifact truth, verification preview, and user-facing delivery explanations.
- **Phase 13 Async Resume Gold Path**: Added a product-facing proof that interrupted tasks can be resumed and then inspected through the same delivery/explanation surface.

### Changed
- **Family-Aware Completion Rules**: Delivery gating now respects task-family trust/automation policies without overwriting real blocking reasons.
- **Inspector Explanations**: Research and browser tasks now produce family-specific explanations and next-action hints instead of generic blocked/completed text.
- **Phase 12 Taxonomy Closure**: Runtime now classifies repeated identical tool loops as `semantic_tool_loop` instead of only falling through to generic loop exhaustion.
- **Resume Runtime Routing**: Resumed nodes now reuse the same resolved model/runtime route as normal execution, preserving model/apiKey injection during replay.

## [1.0.0] - 2026-04-09
### Added
- **Phase 13 Runtime Inspector**: `taskLifecycle.inspectTask()` now produces a structured product-facing inspector with intent, planner policy, plan summary, delivery truth, explanation, and action hint.
- **Artifact Truth & Evidence Preview**: Inspection now includes artifact existence/non-empty truth and verification previews for completed or blocked tasks.
- **Gold-Path Product Proofs**: Added Phase 13 inspection tests that prove both successful and verification-blocked research-writing tasks surface understandable product state.

### Changed
- **Dashboard Lifecycle Panel**: Reworked the lifecycle panel into `Intent / Plan / Delivery / Runtime` sections instead of a flat stream of key-value telemetry.
- **Unified User-Facing Explanations**: Banner, lifecycle inspection, and graph/store summaries now use the same human-readable blocked/failed phrasing instead of raw status fragments.

## [0.9.0] - 2026-04-09
### Added
- **Phase 12 Prompt Pipeline**: Added a single production prompt path rooted in `composePromptPayload(ExecutionContext)` plus a focused integration test for prompt payload propagation.
- **Invalid Output Taxonomy**: Added typed invalid-output classification and `InvalidOutputClassified` events for malformed or non-deliverable runtime envelopes.
- **Typed Join Policy Coverage**: Added Phase 12 join-policy coverage to verify typed `block` join decisions abort tree execution deterministically.

### Changed
- **Evaluator Authority**: Node completion now requires an explicit evaluator `deliver` decision instead of loose implicit stop semantics.
- **Planner Policy Enforcement**: Runtime policy now enforces revise limits and artifact-required delivery constraints structurally, not only through prompt hints.
- **Join Decision Contracts**: Parallel execution paths now normalize join outcomes into typed runtime decisions instead of stringly `stop` branches.

## [0.8.0] - 2026-04-09
### Added
- **Distributed Queue Metadata**: Queued lifecycle and node jobs now carry `ownerId`, `dedupeKey`, and enqueue metadata so workers and inspection tools can reason about ownership and deduplication.
- **Distributed Join Inspection**: `taskLifecycle.inspectTask()` now exposes `latestAsyncNode` and `distributedSummary`, and the dashboard lifecycle panel surfaces queue, settled-node, join, owner, and dedupe facts.
- **Async Writeback Coverage**: Async node/task worker events now persist richer delivery, final-result, and blocking details into the shared task graph.

### Changed
- **Shared Graph Convergence**: Queue-backed parallel execution now creates a distributed join placeholder and updates it to `completed` or `aborted` once all queued children settle.
- **Resume Semantics**: `resumeTask()` now respects persisted distributed state, skips join placeholders, and finalizes distributed join state after unfinished nodes are rerun.
- **Dashboard Distributed Observability**: Connection banner and lifecycle panel now reflect async node ownership, dedupe keys, and distributed queue readiness instead of only task-level async state.

## [0.7.0] - 2026-04-08
### Added
- **Task Lifecycle Control Plane**: Added `src/runtime/taskLifecycle.ts` and `src/runtime/runtimeServices.ts`, giving the runtime a shared `start / resume / inspect / close` control surface that CLI, workers, and API routes can reuse.
- **Dashboard Task APIs**: Added Next.js lifecycle endpoints under `ui/app/api/tasks/` and a dashboard control surface in `ui/components/TaskLifecyclePanel.tsx`.
- **Async Runtime Feedback**: Added async node/task event propagation for queued node execution, plus UI state handling for `AsyncNode*` and `AsyncTask*` events.
- **Release Diary Archive**: Added `diary/` as the home for per-release personal work journals.

### Changed
- **Queue-Backed Parallel Execution**: Parallel execution can now dispatch execution contexts through the shared task queue while preserving runtime events and shared task graph state.
- **Resume with Context Restore**: Resume flow now replays task memory, restores prepared execution contexts, and continues work with recovered retrieval and working-memory state.
- **Dashboard Observability**: Connection banner and graph state now reflect async task results, queue failures, and lifecycle inspection data instead of only synchronous close events.

## [0.6.0] - 2026-04-08
### Added
- **Runtime Executor Core**: Added `src/runtime/executor.ts` and `src/runtime/contracts.ts` so task execution now flows through a dedicated runtime service layer instead of being orchestrated inside the CLI entrypoint.
- **Capability Routing**: Added `src/runtime/capabilities.ts` to authorize tools through capability families such as `research`, `verification`, and `repository`.
- **Memory & Retrieval Runtime**: Added `src/runtime/memory.ts` and `src/runtime/retrieval.ts` with provider-driven enrichment, in-memory retrieval, task-scoped memory storage, and tree-wide write-back summaries.
- **Architecture Handoff Record**: Added `docs/phase-handoff-playbook/2026-04-08-runtime-upgrade-handoff.md` as a restartable phase handoff artifact for the architecture-upgrade branch.

### Changed
- **Context-Native Orchestration**: Orchestrator now accepts `ExecutionContext`-driven execution paths, with executor composing contexts and handing them directly to runtime core APIs.
- **Policy Enforcement**: Planner policy is now enforced at runtime for tool authorization and verification gating instead of existing only as prompt hints.
- **Evaluator-Led Convergence**: Evaluator and policy now jointly drive `stop / revise / block` decisions inside the orchestration loop.
- **Task Memory Persistence**: Tree tiers now write node outputs and join summaries back into task-scoped memory for later retrieval and richer follow-up execution.

## [0.5.1] - 2026-04-08
### Added
- **Runtime Architecture Modules**: Added dedicated `runtime/intent`, `runtime/plan`, `runtime/policy`, and `runtime/context` modules to separate intent classification, planner expansion, policy normalization, and execution context construction from CLI glue.
- **Architecture Roadmap**: Added a phased architecture upgrade roadmap in `docs/superpowers/specs/2026-04-08-runtime-architecture-upgrade-roadmap.md`.
- **Planner Policy Signals**: Planner expansion now emits `recommended_tools`, `required_capabilities`, and `verification_policy` through runtime events.

### Changed
- **Intent-Driven Execution**: Replaced keyword/regex workflow branching with model-driven intent classification plus planner-generated child workflow expansion.
- **Dashboard Observability**: Improved real-time dashboard state handling for task closure, tool phases, node abort/completion, and connection diagnostics.
- **Execution Structuring**: Introduced `ExecutionContext` into the runtime path and reduced direct planning logic embedded in the CLI entrypoint.

## [0.5.0] - 2026-04-08
### Added
- **Autonomous Research Tools**: Added `web_search`, `page_fetch`, `github_readme`, `github_file`, and `verify_sources` local tools for evidence-driven research loops.
- **Delivery Finalization**: Added delivery archiving and file existence/non-empty verification before marking file-based outputs complete.
- **Model Resilience**: Added unhealthy-model persistence and skipping for failed OpenRouter free models.

### Changed
- **Runtime Completion Rules**: Empty deliveries and research tasks without verification evidence are now blocked instead of being reported as completed.
- **Archiving Policy**: User-facing deliverables now go to `artifacts/`, while runtime logs move to `logs/runs/<taskId>/delivery.json`.
- **Prompt/Parsing Robustness**: Orchestrator now tolerates fenced JSON, single-item array envelopes, and retries after empty model responses.

## [0.4.0] - 2026-04-08
### Added
- **UX & Adoption First**: Added preflight checks, template catalog, and adoption report commands.
- **Enterprise Features**: Integrated Redis-backed distributed worker base and RBAC/JWT authentication for WebHub and ToolGateway.
- **Ecosystem**: Implemented Skill Registry (`agentic skill install`) and declarative DAG workflow engine.
- **Messaging**: Integrated WhatsApp bot via Baileys for real-time ChatOps notifications.
- **UI**: Full Next.js Dashboard with React Flow for real-time task visualization.

## [0.3.0] - 2026-04-07
### Added
- **Persistence**: Prisma + SQLite integration for task recovery and event logging.
- **Multi-MCP**: Official MCP SDK integration with McpHub for managing multiple servers.
- **Advanced Scheduling**: Request rate limiting (Token Bucket) and node priority queue.
- **Observability**: OpenTelemetry tracing and real-time cost center reporting.

## [0.2.0] - 2026-04-07
### Added
- **Runtime Enhancements**: EventBus wildcard subscriptions and JSONL persistence.
- **CLI**: Added `--verbose` mode and interactive REPL session.
- **Scheduling**: Support for `runParallelTask` with concurrency limits.

## [0.1.0] - 2026-04-07
### Added
- **MVP Core**: Basic BFS/DFS scheduler, guardrails, and evaluator.
- **Tooling**: Initial Local Tool Registry and OpenRouter integration.
