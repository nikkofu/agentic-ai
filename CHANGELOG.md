# Changelog

All notable changes to this project will be documented in this file.

## [2026-04-08] Phase 4-6 UX & Adoption

### Added
- Quickstart preflight checks via `--preflight`, including actionable diagnostics (`reason` / `fix` / `verify`).
- Prompt template injection via `--template` with built-in `research`, `execution`, and `multi-agent` templates.
- Adoption report output via `--report adoption --since <date>`.
- Team view projection support for dashboard aggregation by actor.
- High-risk tool audit trail hooks around MCP calls.

### Changed
- Dashboard deep link now uses `/dashboard?taskId=<id>`.
- Verbose/event-driven flow now better supports runtime observability scenarios.
- Persistence manager now guards async persistence writes to prevent unhandled rejections from bubbling to global test process state.
- Runtime now tolerates dashboard websocket port conflicts (`EADDRINUSE`) and continues task execution.

### Tested
- Full test suite: `npm test` (96 passed).
- Targeted regression verification for runtime + verbose mode + persistence behavior.
