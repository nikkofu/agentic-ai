import { WebSocketServer, WebSocket } from "ws";
import { EventBus } from "./eventBus";

/**
 * WebHub manages WebSocket connections and broadcasts events from the EventBus to connected clients.
 */
export class WebHub {
  private wss: WebSocketServer | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(private eventBus: EventBus) {}

  /**
   * Starts the WebSocket server and begins broadcasting events.
   * @param port The port to listen on.
   */
  async start(port: number): Promise<void> {
    if (this.wss) {
      return;
    }

    this.wss = new WebSocketServer({ port });

    this.wss.on("connection", (ws: WebSocket) => {
      console.log("[WebHub] Client connected");
      ws.on("error", (err) => console.error("[WebHub] WebSocket error:", err));
    });

    this.unsubscribe = this.eventBus.subscribe("*", (event) => {
      this.broadcast(event);
    });

    console.log(`[WebHub] WebSocket server started on ws://localhost:${port}`);
  }

  /**
   * Broadcasts an event to all connected WebSocket clients.
   * @param event The event to broadcast.
   */
  private broadcast(event: any): void {
    if (!this.wss) return;

    const data = JSON.stringify(event);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  /**
   * Stops the WebSocket server and unsubscribes from the EventBus.
   */
  async stop(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.wss) {
      return new Promise((resolve, reject) => {
        this.wss!.close((err) => {
          if (err) {
            reject(err);
          } else {
            this.wss = null;
            resolve();
          }
        });
      });
    }
  }
}
