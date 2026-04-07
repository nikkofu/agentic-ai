import { eventSchemaRegistry } from "./eventSchemas";

export type RuntimeEvent = {
  type: string;
  payload: Record<string, unknown>;
  ts: number;
};

export type EventSubscriber = (event: RuntimeEvent) => void;

type Subscription = {
  pattern: string;
  callback: EventSubscriber;
};

export type EventBus = {
  publish(event: RuntimeEvent): void;
  subscribe(patternOrCallback: string | EventSubscriber, callback?: EventSubscriber): () => void;
};

export function createInMemoryEventBus(): EventBus {
  const subscriptions: Subscription[] = [];

  return {
    publish(event: RuntimeEvent) {
      const schema = eventSchemaRegistry[event.type as keyof typeof eventSchemaRegistry];
      if (schema) {
        schema.parse(event.payload);
      }

      subscriptions.forEach((subscription) => {
        if (matches(subscription.pattern, event.type)) {
          subscription.callback(event);
        }
      });
    },
    subscribe(patternOrCallback: string | EventSubscriber, callback?: EventSubscriber) {
      let pattern: string;
      let handler: EventSubscriber;

      if (typeof patternOrCallback === "function") {
        pattern = "*";
        handler = patternOrCallback;
      } else {
        pattern = patternOrCallback;
        handler = callback!;
      }

      if (!handler) {
        throw new Error("subscribe requires a callback");
      }

      const entry: Subscription = { pattern, callback: handler };
      subscriptions.push(entry);

      return () => {
        const index = subscriptions.indexOf(entry);
        if (index >= 0) {
          subscriptions.splice(index, 1);
        }
      };
    }
  };
}

function matches(pattern: string, eventType: string): boolean {
  if (pattern === "*" || pattern === "") {
    return true;
  }

  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -2);
    return eventType.startsWith(prefix);
  }

  return pattern === eventType;
}
