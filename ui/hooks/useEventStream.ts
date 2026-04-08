'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTaskStore } from '../store/useTaskStore';

export function useEventStream(taskId: string | null) {
  const processEvent = useTaskStore((state) => state.processEvent);
  const reset = useTaskStore((state) => state.reset);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!taskId) return;

    reset();
    setStatus('connecting');

    const token = searchParams.get('token') || 'valid-session';
    // 使用 127.0.0.1 替代 localhost 避免解析歧义
    const wsUrl = `ws://127.0.0.1:3001?taskId=${taskId}&token=${token}`;
    console.log(`[WS] Connecting to ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected to Event Stream Hub');
      setStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[WS] Received:', data.type);
        processEvent(data);
      } catch (err) {
        console.error('[WS] Failed to parse event data:', err);
      }
    };

    ws.onclose = (e) => {
      console.log(`[WS] Disconnected (Code: ${e.code}, Reason: ${e.reason})`);
      setStatus('disconnected');
    };

    ws.onerror = (err) => {
      console.error('[WS] WebSocket error observed:', err);
      setStatus('disconnected');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [taskId, processEvent, reset, searchParams]);

  return { status };
}
