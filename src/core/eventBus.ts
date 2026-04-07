export type RuntimeEvent = {
  type: string;
  payload: Record<string, unknown>;
  ts: number;
};

export type EventSubscriber = (event: RuntimeEvent) => void;

export function createInMemoryEventBus() {
  const subscribers: EventSubscriber[] = [];

  return {
    publish(event: RuntimeEvent) {
      subscribers.forEach((subscriber) => subscriber(event));
    },
    subscribe(subscriber: EventSubscriber) {
      subscribers.push(subscriber);
    }
  };
}
