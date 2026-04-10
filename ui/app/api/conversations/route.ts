import { NextResponse } from "next/server";

import { createRuntimeServices } from "../../../../src/runtime/runtimeServices";

export async function GET() {
  const services = await createRuntimeServices();

  try {
    const [assistants, threads] = await Promise.all([
      services.conversationStore.listAssistantProfiles(),
      services.conversationStore.listThreads()
    ]);
    const assistantStates = new Map(
      await Promise.all(
        assistants.map(async (assistant) => [
          assistant.assistantId,
          await services.conversationStore.getAssistantChannelState(assistant.assistantId, "whatsapp")
        ] as const)
      )
    );
    const assistantNames = new Map(assistants.map((assistant) => [assistant.assistantId, assistant.displayName]));
    const enrichedThreads = await Promise.all(
      threads.map(async (thread) => {
        const latestEvent = await services.conversationStore.getLatestConversationEvent(thread.threadId);
        const recentEvents = (await services.conversationStore.getConversationEvents(thread.threadId))
          .slice(-3)
          .map((event) => ({
            direction: event.direction,
            summary: typeof event.payload?.summary === "string"
              ? event.payload.summary
              : typeof event.payload?.text === "string"
                ? event.payload.text
                : "",
            createdAt: event.createdAt
          }));
        const taskEvents = thread.activeTaskId ? await services.taskStore.getEvents(thread.activeTaskId) : [];
        const latestHumanAction = [...taskEvents].reverse().find((event) => event.type === "HumanActionRequired");
        const latestEventSummary = typeof latestEvent?.payload?.summary === "string"
          ? latestEvent.payload.summary
          : typeof latestEvent?.payload?.text === "string"
            ? latestEvent.payload.text
            : "";

        return {
          ...thread,
          assistantDisplayName: assistantNames.get(thread.assistantId) ?? thread.assistantId,
          latestEventDirection: latestEvent?.direction ?? "",
          latestEventSummary,
          latestEventAt: latestEvent?.createdAt ?? "",
          recentEvents,
          latestHumanActionNodeId: typeof latestHumanAction?.payload?.node_id === "string" ? latestHumanAction.payload.node_id : undefined
        };
      })
    );

    return NextResponse.json({
      assistants: assistants.map((assistant) => ({
        ...assistant,
        channelConnectionState: assistantStates.get(assistant.assistantId)?.connectionState ?? "unknown"
      })),
      threads: enrichedThreads
    });
  } finally {
    await services.close();
  }
}
