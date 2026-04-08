'use client';

import { startTransition } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTaskStore } from '../store/useTaskStore';

type EventStreamStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

type EventStreamDetails = {
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

export function useEventStream(taskId: string | null) {
  const processEvent = useTaskStore((state) => state.processEvent);
  const reset = useTaskStore((state) => state.reset);
  const [status, setStatus] = useState<EventStreamStatus>('disconnected');
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [details, setDetails] = useState<EventStreamDetails>({
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
  });
  const wsRef = useRef<WebSocket | null>(null);
  const isClosingRef = useRef(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!taskId) {
      startTransition(() => {
        setStatus('disconnected');
        setDetails({
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
        });
      });
      return;
    }

    reset();
    startTransition(() => {
      setStatus('connecting');
    });
    isClosingRef.current = false;

    const token = searchParams.get('token') || 'valid-session';
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://127.0.0.1:3001?taskId=${taskId}&token=${token}`;
    setDetails((current) => ({
      ...current,
      url: wsUrl,
      readyState: 'CONNECTING',
      lastError: '',
      lastCloseCode: null,
      lastCloseReason: ''
    }));
    console.log(`[WS] Connecting to ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected to Event Stream Hub');
      startTransition(() => {
        setStatus('connected');
        setDetails((current) => ({
          ...current,
          readyState: 'OPEN',
          lastError: ''
        }));
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[WS] Received:', data.type);
        processEvent(data);
        setDetails((current) => ({
          ...current,
          lastEventAt: new Date().toISOString(),
          readyState: describeReadyState(ws.readyState),
          lastEventType: readString(data?.type),
          lastNodeId: readString(data?.payload?.node_id),
          lastRole: readString(data?.payload?.role),
          lastModel: readString(data?.payload?.model),
          lastTool: readString(data?.payload?.tool),
          lastDecision: readString(data?.payload?.decision),
          lastLatencyMs: readNumber(data?.payload?.latency_ms),
          lastTotalTokens: readNumber(data?.payload?.usage?.total_tokens) ?? readNumber(data?.payload?.tokens),
          currentPath: buildPath(taskId, readString(data?.payload?.node_id)),
          finalResult: readTaskClosedFinalResult(data?.payload),
          blockingReason: readTaskClosedBlockingReason(data?.payload)
        }));
      } catch (err) {
        console.error('[WS] Failed to parse event data:', err);
      }
    };

    ws.onclose = (e) => {
      if (isClosingRef.current) {
        console.log('[WS] Connection closed during cleanup');
      } else {
        console.log(`[WS] Disconnected (Code: ${e.code}, Reason: ${e.reason || 'n/a'})`);
      }
      startTransition(() => {
        setStatus('disconnected');
        setDetails((current) => ({
          ...current,
          readyState: 'CLOSED',
          lastCloseCode: e.code,
          lastCloseReason: e.reason || 'n/a'
        }));
      });
    };

    ws.onerror = (event) => {
      if (isClosingRef.current) {
        return;
      }

      const target = event.target instanceof WebSocket ? event.target : ws;
      const errorSummary = `socket_error state=${describeReadyState(target.readyState)}`;
      console.warn('[WS] WebSocket error observed', {
        taskId,
        url: target.url || wsUrl,
        readyState: describeReadyState(target.readyState),
        wasCleanShutdown: isClosingRef.current
      });
      startTransition(() => {
        setStatus('error');
        setDetails((current) => ({
          ...current,
          url: target.url || wsUrl,
          readyState: describeReadyState(target.readyState),
          lastError: errorSummary
        }));
      });
    };

    return () => {
      isClosingRef.current = true;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [taskId, processEvent, reconnectNonce, reset, searchParams]);

  return {
    status,
    details,
    reconnect: () => {
      if (!taskId) {
        return;
      }
      startTransition(() => {
        setStatus('connecting');
      });
      setReconnectNonce((current) => current + 1);
    }
  };
}

function describeReadyState(readyState: number) {
  switch (readyState) {
    case WebSocket.CONNECTING:
      return 'CONNECTING';
    case WebSocket.OPEN:
      return 'OPEN';
    case WebSocket.CLOSING:
      return 'CLOSING';
    case WebSocket.CLOSED:
      return 'CLOSED';
    default:
      return `UNKNOWN(${readyState})`;
  }
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

function readTaskClosedFinalResult(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const candidate = (payload as Record<string, unknown>).final_result;
  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate;
  }

  const delivery = (payload as Record<string, unknown>).delivery;
  if (delivery && typeof delivery === 'object') {
    const nested = (delivery as Record<string, unknown>).final_result;
    return typeof nested === 'string' ? nested : '';
  }

  return '';
}

function readTaskClosedBlockingReason(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const candidate = (payload as Record<string, unknown>).blocking_reason;
  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate;
  }

  const delivery = (payload as Record<string, unknown>).delivery;
  if (delivery && typeof delivery === 'object') {
    const nested = (delivery as Record<string, unknown>).blocking_reason;
    return typeof nested === 'string' ? nested : '';
  }

  return '';
}
