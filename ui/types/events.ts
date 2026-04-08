export interface RuntimeEvent {
  type: string;
  payload: any;
  timestamp: string;
}

export interface TaskMetrics {
  totalTokens: number;
  totalCost: number;
}

export interface NodeData {
  label: string;
  role: string;
  status: 'pending' | 'running' | 'waiting_tool' | 'waiting_hitl' | 'evaluating' | 'completed' | 'failed' | 'aborted';
  inputSummary?: string;
  outputSummary?: string;
  decision?: string;
  thought?: string;
  children?: string[];
  degraded?: boolean;
}
