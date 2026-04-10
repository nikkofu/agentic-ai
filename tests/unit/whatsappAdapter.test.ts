import { describe, expect, it, vi } from "vitest";

import { createWhatsAppAdapter, normalizeWhatsAppMessage } from "../../src/bots/whatsappAdapter";

describe("whatsappAdapter", () => {
  it("normalizes an inbound WhatsApp text message", () => {
    const normalized = normalizeWhatsAppMessage({
      key: {
        id: "msg-1",
        remoteJid: "8613800138000@s.whatsapp.net",
        participant: "8613800138000@s.whatsapp.net"
      },
      message: {
        conversation: "帮我继续处理刚才的任务"
      }
    });

    expect(normalized).toEqual({
      messageId: "msg-1",
      externalChatId: "8613800138000@s.whatsapp.net",
      externalUserId: "8613800138000@s.whatsapp.net",
      text: "帮我继续处理刚才的任务"
    });
  });

  it("hands normalized inbound messages to conversation service", async () => {
    const handleIncomingMessage = vi.fn().mockResolvedValue({
      reply: { summary: "已继续刚才中断的任务。" }
    });
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const subscribe = vi.fn();

    const adapter = createWhatsAppAdapter({
      recipientJid: "8613800138000@s.whatsapp.net",
      eventBus: { subscribe } as any,
      conversationService: { handleIncomingMessage } as any,
      socketFactory: async () => ({
        sendMessage,
        ev: {
          on: vi.fn((event: string, listener: (payload: unknown) => void) => {
            if (event === "messages.upsert") {
              listener({
                messages: [{
                  key: {
                    id: "msg-2",
                    remoteJid: "8613800138000@s.whatsapp.net",
                    participant: "8613800138000@s.whatsapp.net"
                  },
                  message: {
                    conversation: "继续刚才那个任务"
                  }
                }]
              });
            }
          })
        }
      }),
      saveCreds: async () => {}
    });

    await adapter.init();

    expect(handleIncomingMessage).toHaveBeenCalledWith({
      assistantId: "assistant-main",
      channelType: "whatsapp",
      externalUserId: "8613800138000@s.whatsapp.net",
      externalChatId: "8613800138000@s.whatsapp.net",
      messageId: "msg-2",
      text: "继续刚才那个任务"
    });
    expect(sendMessage).toHaveBeenCalledWith("8613800138000@s.whatsapp.net", {
      text: "已继续刚才中断的任务。"
    });
  });
});
