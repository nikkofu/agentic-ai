# 2026-04-09 Phase 17 Persistent Assistant Surface Handoff

## Status

`Phase 17` is in active implementation.

The first delivery wave is now functionally established:

1. `Channel Continuity` minimum path is working
2. `Control Center` first layer is visible and actionable
3. `Companionship Layer` has not started yet

## Implemented

### Conversation Continuity Core

- [conversationContracts.ts](/Users/admin/Documents/WORK/ai/agentic-ai/src/runtime/conversationContracts.ts)
- [conversationStore.ts](/Users/admin/Documents/WORK/ai/agentic-ai/src/runtime/conversationStore.ts)
- [conversationService.ts](/Users/admin/Documents/WORK/ai/agentic-ai/src/runtime/conversationService.ts)

Current capabilities:

- assistant / thread / channel-session / conversation-event contracts
- in-memory thread persistence and lookup by WhatsApp identity
- message classification for:
  - `new_task`
  - `status_query`
  - `resume_request`
  - `task_follow_up`
- outgoing conversation summary events

### WhatsApp Adapter

- [whatsappAdapter.ts](/Users/admin/Documents/WORK/ai/agentic-ai/src/bots/whatsappAdapter.ts)
- [runTask.ts](/Users/admin/Documents/WORK/ai/agentic-ai/src/cli/runTask.ts)

Current capabilities:

- inbound WhatsApp message normalization
- forwarding inbound messages to `ConversationService`
- continuity-aware replies
- legacy task start / close notifications preserved through the new adapter path

### Runtime Wiring

- [runtimeServices.ts](/Users/admin/Documents/WORK/ai/agentic-ai/src/runtime/runtimeServices.ts)
- [eventSchemas.ts](/Users/admin/Documents/WORK/ai/agentic-ai/src/core/eventSchemas.ts)
- [taskLifecycle.ts](/Users/admin/Documents/WORK/ai/agentic-ai/src/runtime/taskLifecycle.ts)

Current capabilities:

- default `assistant-main` profile
- shared conversation store in non-test mode
- `ConversationLinked` runtime events
- task inspection includes conversation continuity fields

### Control Center First Layer

- [ConversationPanel.tsx](/Users/admin/Documents/WORK/ai/agentic-ai/ui/components/ConversationPanel.tsx)
- [ConversationListPanel.tsx](/Users/admin/Documents/WORK/ai/agentic-ai/ui/components/ConversationListPanel.tsx)
- [TaskLifecyclePanel.tsx](/Users/admin/Documents/WORK/ai/agentic-ai/ui/components/TaskLifecyclePanel.tsx)
- [route.ts](/Users/admin/Documents/WORK/ai/agentic-ai/ui/app/api/conversations/route.ts)

Current capabilities:

- assistant profile summary card
- current thread detail
- work-queue surface
- control-center thread list
- dedicated thread detail side panel
- assistant display name + persona preview
- latest event preview and event time
- active-only filtering
- `inspect` shortcut for active task threads
- `resume` shortcut for blocked task threads
- clearer queue semantics:
  - `can resume`
  - `needs intervention`
- minimal real `approve` action for `awaiting_user_input` threads with a resolvable `nodeId`

## Verification

Latest focused verification:

```bash
npx vitest run tests/unit/conversationContracts.test.ts tests/unit/conversationStore.test.ts tests/unit/conversationService.test.ts tests/unit/whatsappAdapter.test.ts tests/unit/runtime-executor.test.ts tests/unit/taskLifecycle.test.ts tests/unit/ui-assistant-profile-panel.test.ts tests/unit/ui-conversation-panel.test.ts tests/unit/ui-conversation-list-panel.test.ts tests/unit/ui-thread-work-queue-panel.test.ts tests/unit/ui-thread-detail-panel.test.ts tests/integration/phase17-whatsapp-thread-continuity.test.ts
cd ui && npx tsc --noEmit
```

Result:

- `12` test files
- `53` tests passed
- `ui` typecheck passed

## Remaining For Phase 17

### Still Missing In `Channel Continuity`

- durable conversation persistence
- richer inbound flow proof beyond thread continuity
- production-grade adapter lifecycle management

### Still Missing In `Control Center`

- latest thread activity sorting and filters beyond `active-only`
- richer thread detail page or side panel interactions
- intervention / approval shortcuts beyond the current minimal approve path
- follow-up surface beyond the current work queue

### Not Started Yet

- `Companionship Layer`

## Recommended Next Step

Continue `Control Center` before starting companionship.

Suggested order:

1. thread activity filters and latest-activity emphasis
2. thread detail / work-queue expansion
3. richer `HITL / approval` workflows
4. then start companionship on top of the control center
