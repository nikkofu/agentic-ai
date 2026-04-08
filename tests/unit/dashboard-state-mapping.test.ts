import { describe, it, expect } from 'vitest';
import { mapRuntimeEventToNodeState } from '../../ui/utils/stateMapping';

describe('dashboard event state mapping', () => {
  it('flags node as degraded for GuardrailTripped event', () => {
    const initialNode: any = { id: 'n1', data: { status: 'running' } };
    const event = { type: 'GuardrailTripped', payload: { node_id: 'n1', reason: 'depth' }, ts: 1000 };
    const result = mapRuntimeEventToNodeState(initialNode, event).node;
    expect(result?.data.status).toBe('failed');
    expect((result?.data as any).degraded).toBe(true);
  });

  it('flags node as degraded for fallback event', () => {
    const initialNode: any = { id: 'n1', data: { status: 'running' } };
    const event = { type: 'ModelCalled', payload: { node_id: 'n1', fallback: true }, ts: 1000 };
    const result = mapRuntimeEventToNodeState(initialNode, event).node;
    expect((result?.data as any).degraded).toBe(true);
  });

  it('updates recovery metrics when retry event carries duration', () => {
    const metrics: any = { recoveryEvents: 0 };
    const event = { type: 'ModelCalled', payload: { node_id: 'n1', retry: true, duration: 500 }, ts: 1000 };
    const updated = mapRuntimeEventToNodeState(undefined, event, metrics).metrics;
    expect((updated as any).recoveryEvents).toBe(1);
  });
});
