import { WebClient } from "@slack/web-api";
import { EventBus, RuntimeEvent } from "../core/eventBus";

export class SlackBot {
  private client: WebClient;
  private messageTs: Map<string, string> = new Map();

  constructor(token: string, private channelId: string, private eventBus: EventBus) {
    this.client = new WebClient(token);
  }

  async init() {
    this.eventBus.subscribe("TaskSubmitted", async (event: RuntimeEvent) => {
      try {
        const taskId = event.payload.task_id as string;
        const response = await this.client.chat.postMessage({
          channel: this.channelId,
          text: `🚀 Agent Task Started: ${taskId}`,
          blocks: [
            {
              type: "header",
              text: { type: "plain_text", text: "🚀 Agent Task Started" }
            },
            {
              type: "section",
              text: { type: "mrkdwn", text: `*Task ID:* ` + `\`${taskId}\`` }
            }
          ]
        });
        if (response.ts) this.messageTs.set(taskId, response.ts);
      } catch (err) {
        console.error("[SlackBot] Failed to post start message:", err);
      }
    });

    this.eventBus.subscribe("TaskClosed", async (event: RuntimeEvent) => {
      try {
        const taskId = event.payload.task_id as string;
        const ts = this.messageTs.get(taskId);
        if (!ts) return;

        await this.client.chat.update({
          channel: this.channelId,
          ts,
          text: `✅ Agent Task Finished: ${taskId}`,
          blocks: [
            {
              type: "header",
              text: { type: "plain_text", text: "✅ Agent Task Finished" }
            },
            {
              type: "section",
              text: { type: "mrkdwn", text: `*Task ID:* ` + `\`${taskId}\`` + `\n*Status:* ${event.payload.state}` }
            }
          ]
        });
      } catch (err) {
        console.error("[SlackBot] Failed to update finish message:", err);
      }
    });
  }
}
