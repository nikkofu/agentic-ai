import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { RuntimeEvent } from "../../src/core/eventBus";
import { createJsonlEventLogStore } from "../../src/core/eventLogStore";

describe("jsonl event log store", () => {
  it("appends events as jsonl and reads them back", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "event-log-jsonl-"));
    const filePath = path.join(dir, "events.jsonl");

    const store = createJsonlEventLogStore(filePath);

    const eventA: RuntimeEvent = { type: "TaskSubmitted", payload: { task_id: "t1" }, ts: Date.now() };
    const eventB: RuntimeEvent = { type: "TaskClosed", payload: { task_id: "t1", state: "completed" }, ts: Date.now() };

    store.append(eventA);
    store.append(eventB);

    const raw = fs.readFileSync(filePath, "utf8").trim().split("\n");
    expect(raw.length).toBe(2);

    const parsed = store.getAll();
    expect(parsed).toHaveLength(2);
    expect(parsed[0].type).toBe("TaskSubmitted");
    expect(parsed[1].type).toBe("TaskClosed");
  });
});
