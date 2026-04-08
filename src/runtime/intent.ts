import { classifyIntent } from "../core/intentClassifier";

export type TaskIntent = Awaited<ReturnType<typeof classifyIntent>>;

export { classifyIntent as classifyTaskIntent };
