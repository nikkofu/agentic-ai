import WebSocket, { WebSocketServer } from "ws";
import { URL } from "node:url";
import { EventBus, RuntimeEvent } from "./eventBus";

export class WebHub {
  private wss: WebSocketServer | null = null;
  private unsubscribe: (() => void) | null = null;

  // 修改：构造函数支持传入 logStore 以便实现“历史回放”
  constructor(
    private eventBus: EventBus,
    private logStore?: { getAll: () => RuntimeEvent[] }
  ) {}

  async start(port: number, host: string = "127.0.0.1"): Promise<void> {
    if (this.wss) {
      return;
    }

    try {
      this.wss = new WebSocketServer({ port, host });
    } catch (err) {
      console.warn(`[WebHub] Port ${port} already in use, skipping dashboard stream startup`);
      return;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        if (!this.wss) {
          resolve();
          return;
        }

        const handleListening = () => {
          this.wss?.off("error", handleError);
          resolve();
        };

        const handleError = (error: NodeJS.ErrnoException) => {
          this.wss?.off("listening", handleListening);
          reject(error);
        };

        this.wss.once("listening", handleListening);
        this.wss.once("error", handleError);
      });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code === "EADDRINUSE" || code === "EPERM") {
        console.warn(`[WebHub] Port ${port} unavailable (${code}), skipping dashboard stream startup`);
        this.wss.removeAllListeners();
        this.wss = null;
        return;
      }
      throw error;
    }

    this.wss.on("connection", (ws: WebSocket & { taskId?: string }, req) => {
      const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
      const token = url.searchParams.get("token");
      const taskId = url.searchParams.get("taskId");
      
      if (!token || !token.startsWith("valid-")) {
        console.warn(`[WebHub] Unauthorized connection attempt from ${req.socket.remoteAddress}`);
        ws.close(4001, "Unauthorized");
        return;
      }

      ws.taskId = taskId || undefined;
      console.log(`[WebHub] Client connected (authenticated, taskId=${taskId || 'all'})`);
      
      // 核心改进：回放该任务已有的历史事件
      if (this.logStore && taskId) {
        const history = this.logStore.getAll().filter(e => e.payload.task_id === taskId);
        console.log(`[WebHub] Replaying ${history.length} historical events to client`);
        history.forEach(event => ws.send(JSON.stringify(event)));
      }

      ws.on("error", console.error);
    });

    this.unsubscribe = this.eventBus.subscribe("*", (event: RuntimeEvent) => {
      this.broadcast(event);
    });

    console.log(`[WebHub] WebSocket server started on ws://${host}:${port}`);
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

  isRunning(): boolean {
    return this.wss !== null;
  }

  private broadcast(event: any): void {
    if (!this.wss) return;
    const message = JSON.stringify(event);
    const eventTaskId = event.payload?.task_id;

    this.wss.clients.forEach((client: any) => {
      if (client.readyState === WebSocket.OPEN) {
        // 精准过滤
        if (!client.taskId || client.taskId === eventTaskId) {
          client.send(message);
        }
      }
    });
  }
}
