'use client';

import { useEffect, useRef, useState } from 'react';
import { useTaskStore } from '../store/useTaskStore';

export function useEventStream(taskId: string | null) {
  const processEvent = useTaskStore((state) => state.processEvent);
  const reset = useTaskStore((state) => state.reset);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!taskId) return;

    reset();
    setStatus('connecting');

    const ws = new WebSocket(`ws://localhost:3001?taskId=${taskId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to Event Stream Hub');
      setStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        processEvent(data);
      } catch (err) {
        console.error('Failed to parse event data:', err);
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from Event Stream Hub');
      setStatus('disconnected');
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      setStatus('disconnected');
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [taskId, processEvent, reset]);

  return { status };
}
