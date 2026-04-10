import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import path from "node:path";

import type { EventBus, RuntimeEvent } from "../core/eventBus";
import type { IncomingConversationMessage } from "../runtime/conversationService";

type ConversationService = {
  handleIncomingMessage(input: IncomingConversationMessage): Promise<{
    reply: { summary: string };
  }>;
};

type SocketLike = {
  sendMessage: (jid: string, message: { text: string }) => Promise<unknown>;
  ev: {
    on: (event: string, listener: (payload: any) => void) => void;
  };
};

export function normalizeWhatsAppMessage(message: any):
  | {
      messageId: string;
      externalChatId: string;
      externalUserId: string;
      text: string;
    }
  | null {
  const text =
    typeof message?.message?.conversation === "string"
      ? message.message.conversation
      : typeof message?.message?.extendedTextMessage?.text === "string"
        ? message.message.extendedTextMessage.text
        : "";

  const externalChatId = typeof message?.key?.remoteJid === "string" ? message.key.remoteJid : "";
  const externalUserId =
    typeof message?.key?.participant === "string"
      ? message.key.participant
      : externalChatId;
  const messageId = typeof message?.key?.id === "string" ? message.key.id : "";

  if (!text.trim() || !externalChatId || !externalUserId || !messageId) {
    return null;
  }

  return {
    messageId,
    externalChatId,
    externalUserId,
    text
  };
}

export function createWhatsAppAdapter(deps: {
  recipientJid: string;
  eventBus: EventBus;
  conversationService: ConversationService;
  assistantId?: string;
  socketFactory?: () => Promise<SocketLike>;
  saveCreds?: () => Promise<void>;
}) {
  const assistantId = deps.assistantId ?? "assistant-main";
  let sock: SocketLike | null = null;

  return {
    async init() {
      if (!deps.socketFactory) {
        const { state, saveCreds } = await useMultiFileAuthState(path.join(process.cwd(), "auth_info_baileys"));

        sock = makeWASocket({
          auth: state,
          printQRInTerminal: true
        }) as unknown as SocketLike;

        sock.ev.on("creds.update", saveCreds as any);
        sock.ev.on("connection.update", (update: any) => {
          const { connection, lastDisconnect, qr } = update;
          if (qr) {
            qrcode.generate(qr, { small: true });
          }
          if (connection === "close") {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
              void this.init();
            }
          }
        });
      } else {
        sock = await deps.socketFactory();
        if (deps.saveCreds) {
          sock.ev.on("creds.update", deps.saveCreds as any);
        }
      }

      sock.ev.on("messages.upsert", async (event: any) => {
        for (const message of event?.messages ?? []) {
          const normalized = normalizeWhatsAppMessage(message);
          if (!normalized || !sock) continue;

          const result = await deps.conversationService.handleIncomingMessage({
            assistantId,
            channelType: "whatsapp",
            externalUserId: normalized.externalUserId,
            externalChatId: normalized.externalChatId,
            messageId: normalized.messageId,
            text: normalized.text
          });

          await sock.sendMessage(normalized.externalChatId, {
            text: result.reply.summary
          });
        }
      });

      deps.eventBus.subscribe("TaskSubmitted", async (event: RuntimeEvent) => {
        if (!sock) return;
        try {
          await sock.sendMessage(deps.recipientJid, {
            text: `🚀 *Agent Task Started*\n\n*Task ID:* ${String(event.payload.task_id ?? "")}`
          });
        } catch (err) {
          console.error("[WhatsAppAdapter] Failed to send start message:", err);
        }
      });

      deps.eventBus.subscribe("TaskClosed", async (event: RuntimeEvent) => {
        if (!sock) return;
        try {
          await sock.sendMessage(deps.recipientJid, {
            text: `✅ *Agent Task Finished*\n\n*Task ID:* ${String(event.payload.task_id ?? "")}\n*Status:* ${String(event.payload.state ?? "")}`
          });
        } catch (err) {
          console.error("[WhatsAppAdapter] Failed to send finish message:", err);
        }
      });
    }
  };
}
