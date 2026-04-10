import { describe, it, expect, vi, afterEach } from "vitest";
import WebSocket from "ws";
import { WebHub } from "../../src/core/webHub";
import { createInMemoryEventBus } from "../../src/core/eventBus";

describe("WebHub", () => {
  let hub: WebHub | null = null;

  afterEach(async () => {
    if (hub) {
      await hub.stop();
      hub = null;
    }
  });

  it("should broadcast events to connected clients when authenticated", async () => {
    const eventBus = createInMemoryEventBus();
    hub = new WebHub(eventBus as any);
    await hub.start(3002);
    if (!hub.isRunning()) {
      expect(hub.isRunning()).toBe(false);
      return;
    }

    const client = new WebSocket("ws://localhost:3002?token=valid-test");
    
    await new Promise((resolve, reject) => {
      client.on("open", resolve);
      client.on("error", reject);
      setTimeout(() => reject(new Error("Handshake timeout")), 2000);
    });

    const testEvent = { type: "TestEvent", payload: { foo: "bar" }, ts: Date.now() };
    
    const messagePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout waiting for message")), 2000);
      client.on("message", (data) => {
        clearTimeout(timeout);
        resolve(JSON.parse(data.toString()));
      });
    });

    eventBus.publish(testEvent);

    const received = await messagePromise;
    expect(received).toEqual(testEvent);

    client.close();
  });

  it("should close connection if token is invalid", async () => {
    const eventBus = createInMemoryEventBus();
    hub = new WebHub(eventBus as any);
    await hub.start(3003);
    if (!hub.isRunning()) {
      expect(hub.isRunning()).toBe(false);
      return;
    }

    const client = new WebSocket("ws://localhost:3003?token=invalid");
    
    const closedPromise = new Promise((resolve) => {
      client.on("close", (code) => resolve(code));
    });

    const code = await closedPromise;
    expect(code).toBe(4001);
  });
});
