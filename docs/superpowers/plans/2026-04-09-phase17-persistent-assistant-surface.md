# 2026-04-09 Phase 17 Persistent Assistant Surface

## Goal

Phase 17 turns the current runtime and delivery platform into a persistent assistant surface.

This phase is intentionally sequenced:

1. `Channel Continuity`
2. `Control Center`
3. `Companionship Layer`

The first implementation wave focuses on `Channel Continuity` for WhatsApp while designing interfaces that can support future channels.

## Scope

### In Scope

- generic channel adapter contract
- first `WhatsAppAdapter`
- `ConversationService`
- assistant identity model
- conversation thread model
- channel session linking
- thread-aware routing into `taskLifecycle`
- minimal continuity-aware replies
- dashboard/control-center preparation for thread-aware surfaces

### Out of Scope

- voice
- advanced media flows
- group-chat policy complexity
- channel-native business logic
- full companionship features

## Implementation Tasks

### Task 1: Shared Channel and Conversation Contracts

#### Goal

Create the shared contracts for:

- `ChannelAdapter`
- `AssistantIdentity`
- `ConversationThread`
- `ChannelSessionLink`
- `ConversationEvent`

#### Files

- `src/runtime/conversationContracts.ts`
- `src/types/runtime.ts`
- `tests/unit/conversationContracts.test.ts`

#### TDD Steps

1. add failing tests for thread state and message classification contracts
2. add shared types and validation helpers
3. confirm no runtime regressions in existing task lifecycle types

#### Verification

```bash
npx vitest run tests/unit/conversationContracts.test.ts
```

### Task 2: Conversation Persistence and Resolution

#### Goal

Add persistence and lookup support for:

- assistant profiles
- conversation threads
- channel session links
- conversation events

#### Files

- `src/runtime/conversationStore.ts`
- `src/core/prismaTaskStore.ts` or dedicated persistence module
- `tests/unit/conversationStore.test.ts`

#### TDD Steps

1. write failing tests for thread creation and lookup by external WhatsApp identity
2. add thread update and active-task linking behavior
3. add conversation event append/read support

#### Verification

```bash
npx vitest run tests/unit/conversationStore.test.ts
```

### Task 3: ConversationService

#### Goal

Add the central continuity service that:

- classifies incoming messages
- resolves or creates threads
- maps messages to lifecycle actions
- shapes assistant reply envelopes

#### Files

- `src/runtime/conversationService.ts`
- `src/runtime/runtimeServices.ts`
- `tests/unit/conversationService.test.ts`
- `tests/integration/phase17-whatsapp-thread-continuity.test.ts`

#### TDD Steps

1. write failing tests for:
   - `new_task`
   - `status_query`
   - `resume_request`
   - `task_follow_up`
2. connect conversation service to `taskLifecycle`
3. verify thread status transitions across task events

#### Verification

```bash
npx vitest run tests/unit/conversationService.test.ts tests/integration/phase17-whatsapp-thread-continuity.test.ts
```

### Task 4: WhatsApp Adapter

#### Goal

Replace the current notification-only WhatsApp bot path with a true adapter that:

- receives inbound messages
- normalizes them
- forwards them to `ConversationService`
- sends continuity-aware outbound replies

#### Files

- `src/bots/whatsappAdapter.ts`
- `src/cli/runTask.ts`
- `tests/unit/whatsappAdapter.test.ts`
- `tests/integration/phase17-whatsapp-inbound-task-flow.test.ts`

#### TDD Steps

1. write failing tests for incoming message normalization
2. write failing tests for outbound response formatting
3. keep current event-notification behavior only if it maps cleanly into the new service path

#### Verification

```bash
npx vitest run tests/unit/whatsappAdapter.test.ts tests/integration/phase17-whatsapp-inbound-task-flow.test.ts
```

### Task 5: Thread-Aware Control Center Foundations

#### Goal

Prepare the dashboard to understand:

- assistant identity
- conversation threads
- active task linkage
- continuity state

This task does not fully implement the Phase 17 control center, but it creates the first thread-aware product surface.

#### Files

- `src/runtime/taskLifecycle.ts`
- `ui/components/TaskLifecyclePanel.tsx`
- `ui/store/useTaskStore.ts`
- `tests/unit/taskLifecycle.test.ts`
- `tests/unit/ui-task-store.test.ts`

#### TDD Steps

1. add inspection fields for thread/assistant continuity
2. add store projections for thread status
3. confirm blocked/completed tasks can still be inspected through a persistent thread surface

#### Verification

```bash
npx vitest run tests/unit/taskLifecycle.test.ts tests/unit/ui-task-store.test.ts
cd ui && npx tsc --noEmit
```

### Task 6: Release-Grade Verification and Docs

#### Goal

Document and verify the first Phase 17 delivery wave.

#### Files

- `README.md`
- `CHANGELOG.md`
- `docs/phase-handoff-playbook/2026-04-09-phase17-persistent-assistant-surface-handoff.md`
- `diary/2026-04-09-v1.5.0.md`

#### Verification

```bash
npx vitest run tests/unit/conversationContracts.test.ts tests/unit/conversationStore.test.ts tests/unit/conversationService.test.ts tests/unit/whatsappAdapter.test.ts tests/unit/taskLifecycle.test.ts tests/unit/ui-task-store.test.ts tests/integration/phase17-whatsapp-thread-continuity.test.ts tests/integration/phase17-whatsapp-inbound-task-flow.test.ts
cd ui && npx tsc --noEmit
```

## Recommended Order

Implement strictly in this order:

1. contracts
2. persistence
3. conversation service
4. WhatsApp adapter
5. thread-aware control center foundations
6. release verification and docs

This keeps continuity as the architectural center rather than letting the channel adapter or dashboard become the accidental owner of assistant behavior.

## Success Criteria

Phase 17 first-wave success means:

1. a WhatsApp user can return and continue through the same assistant thread
2. the same thread can:
   - start tasks
   - inspect active tasks
   - resume blocked tasks
3. task completion and blocking states flow back into the thread
4. the dashboard can show the assistant/thread/task relationship
5. the design remains extensible for future channels
