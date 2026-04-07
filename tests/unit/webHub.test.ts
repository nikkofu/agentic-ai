import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WebSocket } from "ws";
import { WebHub } from "../../src/core/webHub";
import { createInMemoryEventBus, EventBus } from "../../src/core/eventBus";

describe("WebHub", () => {
  let eventBus: EventBus;
  let webHub: any;
  const PORT = 3001;

  beforeEach(() => {
    eventBus = createInMemoryEventBus();
    webHub = new WebHub(eventBus);
  });

  afterEach(async () => {
    if (webHub) {
      await webHub.stop();
    }
  });

  it("should broadcast events to connected clients", async () => {
    await webHub.start(PORT);

    const client = new WebSocket("ws://localhost:" + PORT);
    
    const messagePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout waiting for message")), 2000);
      client.on("message", (data) => {
        clearTimeout(timeout);
        resolve(JSON.parse(data.toString()));
      });
    });

    // Wait for connection
    await new Promise((resolve) => client.on("open", resolve));

    const testEvent = {
      type: "test.event",
      payload: { foo: "bar" },
      ts: Date.now(),
    };

    eventBus.publish(testEvent);

    const receivedEvent = await messagePromise;
    expect(receivedEvent).toEqual(testEvent);

    client.close();
  });
});
