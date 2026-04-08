# Changelog

All notable changes to this project will be documented in this file.

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
