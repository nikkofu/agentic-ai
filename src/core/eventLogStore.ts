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
