'use client';

import { startTransition } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTaskStore } from '../store/useTaskStore';
import { applyRuntimeEventToStreamState, createInitialEventStreamDetails, type EventStreamDetails } from './eventStreamState';

type EventStreamStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function useEventStream(taskId: string | null) {
  const processEvent = useTaskStore((state) => state.processEvent);
  const reset = useTaskStore((state) => state.reset);
  const [status, setStatus] = useState<EventStreamStatus>('disconnected');
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [details, setDetails] = useState<EventStreamDetails>(createInitialEventStreamDetails());
  const wsRef = useRef<WebSocket | null>(null);
  const isClosingRef = useRef(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!taskId) {
      startTransition(() => {
        setStatus('disconnected');
        setDetails(createInitialEventStreamDetails());
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
          ...applyRuntimeEventToStreamState({
            taskId,
            current,
            event: data
          }),
          readyState: describeReadyState(ws.readyState),
        }));
        if (data?.type === 'AsyncTaskFailed') {
          startTransition(() => {
            setStatus('error');
          });
        }
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
