export type EventStreamDetails = {
  url: string;
  readyState: string;
  lastError: string;
  lastCloseCode: number | null;
  lastCloseReason: string;
  lastEventAt: string | null;
  lastEventType: string;
  lastNodeId: string;
  lastRole: string;
  lastModel: string;
  lastTool: string;
  lastDecision: string;
  lastLatencyMs: number | null;
  lastTotalTokens: number | null;
  currentPath: string;
  finalResult: string;
  blockingReason: string;
};

export function createInitialEventStreamDetails(): EventStreamDetails {
  return {
    url: '',
    readyState: 'CLOSED',
    lastError: '',
    lastCloseCode: null,
    lastCloseReason: '',
    lastEventAt: null,
    lastEventType: '',
    lastNodeId: '',
    lastRole: '',
    lastModel: '',
    lastTool: '',
    lastDecision: '',
    lastLatencyMs: null,
    lastTotalTokens: null,
    currentPath: '',
    finalResult: '',
    blockingReason: ''
  };
}

export function applyRuntimeEventToStreamState(args: {
  taskId: string;
  current: EventStreamDetails;
  event: {
    type?: unknown;
    payload?: unknown;
  };
}): EventStreamDetails {
  const { taskId, current, event } = args;
  const payload = readRecord(event.payload);
  const eventType = readString(event.type);

  return {
    ...current,
    lastEventAt: new Date().toISOString(),
    lastEventType: eventType,
    lastNodeId: readString(payload.node_id),
    lastRole: readString(payload.role),
    lastModel: readString(payload.model),
    lastTool: readString(payload.tool),
    lastDecision: readString(payload.decision),
    lastLatencyMs: readNumber(payload.latency_ms),
    lastTotalTokens: readNumber(readRecord(payload.usage).total_tokens) ?? readNumber(payload.tokens),
    currentPath: buildPath(taskId, readString(payload.node_id)),
    finalResult: readTaskFinalResult(payload),
    blockingReason: readTaskBlockingReason(payload),
    lastError: eventType === "AsyncTaskFailed"
      ? readString(payload.error) || current.lastError
      : current.lastError
  };
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function buildPath(taskId: string, nodeId: string) {
  return nodeId ? `${taskId} > ${nodeId}` : taskId;
}

function readTaskFinalResult(payload: Record<string, unknown>) {
  const candidate = payload.final_result;
  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate;
  }

  const delivery = readRecord(payload.delivery);
  const nested = delivery.final_result;
  return typeof nested === 'string' ? nested : '';
}

function readTaskBlockingReason(payload: Record<string, unknown>) {
  const candidate = payload.blocking_reason;
  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate;
  }

  const delivery = readRecord(payload.delivery);
  const nested = delivery.blocking_reason;
  return typeof nested === 'string' ? nested : '';
}
