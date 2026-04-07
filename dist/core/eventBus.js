import { eventSchemaRegistry } from "./eventSchemas";
export function createInMemoryEventBus() {
    const subscriptions = [];
    return {
        publish(event) {
            const schema = eventSchemaRegistry[event.type];
            if (schema) {
                schema.parse(event.payload);
            }
            subscriptions.forEach((subscription) => {
                if (matches(subscription.pattern, event.type)) {
                    subscription.callback(event);
                }
            });
        },
        subscribe(patternOrCallback, callback) {
            const pattern = typeof patternOrCallback === "string" ? patternOrCallback : "*";
            const handler = typeof patternOrCallback === "function" ? patternOrCallback : callback;
            if (!handler) {
                throw new Error("subscribe requires a callback");
            }
            const entry = { pattern, callback: handler };
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
function matches(pattern, eventType) {
    if (pattern === "*") {
        return true;
    }
    if (pattern.endsWith(".*")) {
        const prefix = pattern.slice(0, -2);
        return eventType.startsWith(prefix);
    }
    return pattern === eventType;
}
