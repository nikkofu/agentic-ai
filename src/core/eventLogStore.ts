import fs from "node:fs";

import type { RuntimeEvent } from "./eventBus";

export function createInMemoryEventLogStore() {
  const events: RuntimeEvent[] = [];

  return {
    append(event: RuntimeEvent) {
      events.push(event);
    },
    getAll() {
      return events;
    }
  };
}

export function createJsonlEventLogStore(filePath: string) {
  return {
    append(event: RuntimeEvent) {
      fs.appendFileSync(filePath, `${JSON.stringify(event)}\n`, "utf8");
    },
    getAll(): RuntimeEvent[] {
      if (!fs.existsSync(filePath)) {
        return [];
      }

      const lines = fs
        .readFileSync(filePath, "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      return lines.map((line) => JSON.parse(line) as RuntimeEvent);
    }
  };
}
