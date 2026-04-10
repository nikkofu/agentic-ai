import { describe, expect, it } from "vitest";
import {
  CHANNEL_MESSAGE_KINDS,
  CHANNEL_TYPES,
  CONVERSATION_THREAD_STATES,
  isConversationMessageKind,
  isConversationThreadState
} from "../../src/runtime/conversationContracts";

describe("conversationContracts", () => {
  it("exposes supported channel types", () => {
    expect(CHANNEL_TYPES).toContain("whatsapp");
  });

  it("exposes supported conversation thread states", () => {
    expect(CONVERSATION_THREAD_STATES).toEqual([
      "idle",
      "awaiting_task_execution",
      "task_running",
      "awaiting_user_input",
      "task_blocked",
      "task_completed",
      "handoff_pending",
      "disconnected"
    ]);
    expect(isConversationThreadState("task_running")).toBe(true);
    expect(isConversationThreadState("made_up_state")).toBe(false);
  });

  it("exposes supported conversation message kinds", () => {
    expect(CHANNEL_MESSAGE_KINDS).toEqual([
      "chat",
      "new_task",
      "task_follow_up",
      "status_query",
      "resume_request",
      "approval_response",
      "clarification_response"
    ]);
    expect(isConversationMessageKind("resume_request")).toBe(true);
    expect(isConversationMessageKind("unknown")).toBe(false);
  });
});
