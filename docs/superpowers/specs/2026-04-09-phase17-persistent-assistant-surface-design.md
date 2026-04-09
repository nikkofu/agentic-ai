# 2026-04-09 Phase 17 Persistent Assistant Surface Design

## Purpose

Phase 17 moves the project from a strong runtime and delivery platform toward a persistent assistant product surface.

The goal is not to replace the runtime kernel. The goal is to place a continuous assistant layer on top of it.

This phase is intentionally sequenced in three parts:

1. `Channel Continuity`
2. `Control Center`
3. `Companionship Layer`

This design focuses first on `Channel Continuity`, while defining the boundaries required for the later two parts.

## Why This Phase Comes Next

By the end of Phase 16, the project already has:

- a strong orchestrator/executor core
- delivery proof and verifier acceptance
- task lifecycle control
- runtime inspection
- memory productization and Dream runtime

What it still lacks is the feeling of a persistent assistant that:

- exists across conversations
- remains identifiable over time
- keeps continuity across interactions
- can be managed as an ongoing relationship, not just as isolated task execution

This is the main gap relative to product-oriented systems such as OpenClaw and memory-centric systems such as Hermes Agent.

## Phase 17 Sequence

### Part 1: Channel Continuity

First implementation target:

- WhatsApp only

Design requirement:

- the interface must be generic enough to support future channels

### Part 2: Control Center

After continuity is established:

- upgrade the dashboard into a real assistant control center
- unify threads, tasks, verification, intervention, and memory inspection

### Part 3: Companionship Layer

Only after continuity and control exist:

- expose assistant identity
- surface long-term continuity and follow-up loops
- make relationship memory visible and useful

## Design Principles

1. Do not duplicate runtime logic inside a channel bot.
2. Keep channel protocol handling separate from assistant behavior.
3. Keep conversations and tasks distinct but linked.
4. Preserve verifier-backed delivery and lifecycle rigor.
5. Make channel continuity future-proof for more channels.

## Recommended Architecture

Phase 17 Channel Continuity is built from five core components:

1. `ChannelAdapter`
2. `ConversationService`
3. `AssistantIdentity`
4. `ConversationThread`
5. `ChannelSessionLink`

### 1. ChannelAdapter

Responsibility:

- speak the protocol of an external channel
- normalize incoming messages
- send outgoing messages
- report connection state and adapter-level failures

First implementation:

- `WhatsAppAdapter`

Non-goals for the adapter:

- planner logic
- task routing
- assistant memory decisions
- verifier decisions

The adapter should remain thin.

### 2. ConversationService

This is the core of Phase 17.

Responsibility:

- identify the user
- resolve or create a thread
- classify the meaning of the incoming message
- connect conversation continuity to task lifecycle
- shape the assistant response envelope

This service sits between the external channel and the existing runtime.

It should decide whether an incoming message represents:

- normal chat
- a new task request
- a follow-up to an existing task
- a status query
- a resume request
- an approval or rejection
- a clarification response

### 3. AssistantIdentity

Assistant identity must not be channel-specific.

It should define:

- `assistantId`
- `displayName`
- `personaProfile`
- `memoryPolicy`
- `channelPolicies`

This allows the same assistant identity to persist across future channels rather than creating a different assistant implementation per platform.

### 4. ConversationThread

The thread is the main continuity anchor.

It should carry:

- `threadId`
- `assistantId`
- `userIdentityKey`
- `status`
- `activeTaskId?`
- `lastInteractionAt`
- `continuityState`
- `memoryRefs`

The thread is not the same thing as a task.

A thread may:

- create tasks
- continue tasks
- reference completed tasks
- remain alive after a task completes

### 5. ChannelSessionLink

This maps external channel identity onto internal continuity.

It should minimally record:

- `channelType`
- `externalUserId`
- `externalChatId`
- `threadId`
- `assistantId`
- `lastSeenAt`
- `connectionState`

This is what makes future multi-channel continuity possible.

## Message Classification Model

The first implementation should classify incoming messages into the following kinds:

- `chat`
- `new_task`
- `task_follow_up`
- `status_query`
- `resume_request`
- `approval_response`
- `clarification_response`

This classification should happen in `ConversationService`, not inside the WhatsApp adapter and not inside the runtime executor.

## Conversation State Model

`ConversationThread` should use a lifecycle separate from task lifecycle.

Recommended states:

- `idle`
- `awaiting_task_execution`
- `task_running`
- `awaiting_user_input`
- `task_blocked`
- `task_completed`
- `handoff_pending`
- `disconnected`

### State Meanings

`idle`
- no active task
- continuity still exists

`awaiting_task_execution`
- user intent has been recognized
- task has not yet been dispatched

`task_running`
- thread is linked to an active `taskId`

`awaiting_user_input`
- runtime, verifier, or intervention flow needs user input

`task_blocked`
- task is blocked but thread continuity remains alive

`task_completed`
- the task has completed, but the thread remains available for follow-up

`handoff_pending`
- requires explicit human intervention or approval

`disconnected`
- channel is temporarily unavailable but the continuity anchor is preserved

## First-Phase WhatsApp Scope

Phase 17 Part 1 should only aim to support:

- receiving a WhatsApp message
- resolving or creating a continuity thread
- triggering or resuming task activity through the existing lifecycle
- sending:
  - normal assistant replies
  - task started summaries
  - task completed summaries
  - blocked/rejected summaries
  - follow-up prompts

It should not yet include:

- voice
- advanced media workflows
- rich cards
- multi-device orchestration
- complex group-chat policies

## Data Model

The assistant continuity layer should use dedicated persistence objects rather than overloading task graph state.

### `assistant_profiles`

Fields:

- `assistant_id`
- `display_name`
- `persona_profile`
- `memory_policy`
- `channel_policies`
- `created_at`
- `updated_at`

Purpose:

- define the assistant as a durable identity

### `conversation_threads`

Fields:

- `thread_id`
- `assistant_id`
- `user_identity_key`
- `status`
- `active_task_id`
- `last_interaction_at`
- `continuity_state`
- `memory_refs_json`

Purpose:

- durable thread continuity across task boundaries

### `channel_session_links`

Fields:

- `link_id`
- `thread_id`
- `assistant_id`
- `channel_type`
- `external_user_id`
- `external_chat_id`
- `last_seen_at`
- `connection_state`

Purpose:

- connect external channel identity to internal assistant continuity

### `conversation_events`

Fields:

- `event_id`
- `thread_id`
- `channel_type`
- `direction`
- `kind`
- `payload_json`
- `created_at`

Purpose:

- preserve conversation history as a structured event stream

## Data Flow

Recommended incoming path:

1. WhatsApp message arrives
2. `WhatsAppAdapter.normalizeIncoming()`
3. `ConversationService.handleIncomingMessage()`
4. resolve `assistantId`
5. resolve or create `threadId`
6. classify message kind
7. map to:
   - conversation reply
   - lifecycle `startTask`
   - lifecycle `resumeTask`
   - lifecycle `inspectTask`
   - intervention branch
8. create assistant response envelope
9. `WhatsAppAdapter.sendOutgoing()`

Recommended outgoing path:

1. task status or direct reply produced
2. `ConversationService.shapeResponse()`
3. persist conversation event
4. adapter sends formatted channel message

## Relationship to the Existing Runtime

Channel continuity must sit in front of the runtime, not inside it.

Recommended division of responsibility:

- `ChannelAdapter`
  - external protocol
- `ConversationService`
  - continuity and routing
- `taskLifecycle`
  - task control
- `executor / orchestrator`
  - execution
- `verifier`
  - acceptance and rejection
- `memory engine`
  - long-term retention

This preserves the integrity of the runtime kernel while making it product-usable.

## Recovery and Failure Semantics

### Channel Recovery

If WhatsApp disconnects:

- adapter should reconnect
- thread continuity must remain intact
- no new thread should be created for the same conversation identity unless explicitly required

### Duplicate Message Handling

The adapter or conversation service should deduplicate external message identifiers before creating conversation events.

### Task-Linked Follow-Up

If the thread has an active task and a new incoming message arrives, the conversation service must decide whether it is:

- a follow-up request
- a clarification
- a status query
- a manual intervention

This is a core persistent-assistant behavior and should not be left to ad hoc keyword hacks.

### Blocked Task Behavior

If the bound task becomes blocked or verifier-rejected:

- do not close the thread
- move the thread into `task_blocked`
- respond with:
  - clear blocking reason
  - next action suggestion
  - whether the task can be resumed

This is what separates persistent continuity from disposable bot behavior.

## Success Criteria for Part 1

Phase 17 Part 1 is successful when:

1. the same WhatsApp user can continue through the same assistant thread over time
2. messages can start, inspect, or resume tasks through the thread
3. blocked/completed task state is reflected back into the thread
4. the system does not create a fresh task-only interaction model for each message
5. the design remains generic enough to support future channels

## What This Unlocks Next

Once Channel Continuity exists, the next two parts become much more coherent:

### Control Center

The dashboard can evolve from inspector to control center because threads, channel links, and assistant identity will now be first-class objects.

### Companionship Layer

Long-term memory, follow-up, assistant tone, and daily-use continuity will have a stable thread and identity surface to attach to.

## Recommendation

Phase 17 should begin with a `ConversationService`-based WhatsApp continuity layer rather than extending the current notification-only bot directly.

This is the cleanest path because it:

- preserves the runtime kernel
- creates a reusable channel abstraction
- prepares the project for more channels
- establishes continuity before adding more product surface

The first implementation should remain intentionally narrow:

- WhatsApp only
- continuity only
- no rich media
- no channel-specific business logic

That will create the strongest base for the rest of Phase 17.
