import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import path from "node:path";
import { EventBus, RuntimeEvent } from "../core/eventBus";

export class WhatsAppBot {
  private sock: any;
  private isReady: boolean = false;

  constructor(private recipientJid: string, private eventBus: EventBus) {}

  async init() {
    const { state, saveCreds } = await useMultiFileAuthState(path.join(process.cwd(), "auth_info_baileys"));

    this.sock = makeWASocket({
      auth: state,
      printQRInTerminal: true
    });

    this.sock.ev.on("creds.update", saveCreds);

    this.sock.ev.on("connection.update", (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        qrcode.generate(qr, { small: true });
      }
      if (connection === "close") {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log("connection closed due to ", lastDisconnect?.error, ", reconnecting ", shouldReconnect);
        if (shouldReconnect) {
          this.init();
        }
      } else if (connection === "open") {
        console.log("opened connection");
        this.isReady = true;
      }
    });

    this.eventBus.subscribe("TaskSubmitted", async (event: RuntimeEvent) => {
      if (!this.isReady) return;
      try {
        await this.sock.sendMessage(this.recipientJid, { 
          text: `🚀 *Agent Task Started*\n\n*Task ID:* ` + `${event.payload.task_id}`
        });
      } catch (err) {
        console.error("[WhatsAppBot] Failed to send start message:", err);
      }
    });

    this.eventBus.subscribe("TaskClosed", async (event: RuntimeEvent) => {
      if (!this.isReady) return;
      try {
        await this.sock.sendMessage(this.recipientJid, { 
          text: `✅ *Agent Task Finished*\n\n*Task ID:* ` + `${event.payload.task_id}\n*Status:* ${event.payload.state}`
        });
      } catch (err) {
        console.error("[WhatsAppBot] Failed to send finish message:", err);
      }
    });
  }
}
