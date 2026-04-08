import WebSocket, { WebSocketServer } from "ws";
import { URL } from "node:url";
import { EventBus, RuntimeEvent } from "./eventBus";

export class WebHub {
  private wss: WebSocketServer | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(private eventBus: EventBus) {}

  async start(port: number): Promise<void> {
    if (this.wss) {
      return;
    }

    try {
      this.wss = new WebSocketServer({ port });
    } catch (err) {
      console.warn(`[WebHub] Port ${port} already in use, skipping dashboard stream startup`);
      return;
    }

    this.wss.on("connection", (ws: WebSocket, req) => {
      // Basic token check simulation for enterprise RBAC
      const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
      const token = url.searchParams.get("token");
      
      if (!token || !token.startsWith("valid-")) {
        console.warn(`[WebHub] Unauthorized connection attempt from ${req.socket.remoteAddress}`);
        ws.close(4001, "Unauthorized");
        return;
      }

      console.log(`[WebHub] Client connected (authenticated)`);
      ws.on("error", console.error);
    });

    this.unsubscribe = this.eventBus.subscribe("*", (event: RuntimeEvent) => {
      this.broadcast(event);
    });

    console.log(`[WebHub] WebSocket server started on ws://localhost:${port}`);
  }

  async stop(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.wss) {
      return new Promise((resolve) => {
        this.wss!.close(() => {
          this.wss = null;
          resolve();
        });
      });
    }
  }

  private broadcast(event: any): void {
    if (!this.wss) return;
    const message = JSON.stringify(event);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}
