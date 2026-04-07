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

export function createInMemoryEventBus() {
  const subscriptions: Subscription[] = [];

  return {
    publish(event: RuntimeEvent) {
      subscriptions.forEach((subscription) => {
        if (matches(subscription.pattern, event.type)) {
          subscription.callback(event);
        }
      });
    },
    subscribe(pattern: string, callback: EventSubscriber) {
      const entry: Subscription = { pattern, callback };
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
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -1);
    return eventType.startsWith(prefix);
  }

  return pattern === eventType;
}
