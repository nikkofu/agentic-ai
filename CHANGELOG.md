# Changelog

All notable changes to this project will be documented in this file.

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
