export interface DagNode {
  id: string;
  role: string;
  input: any;
  depends_on: string[];
}

export interface DagWorkflow {
  nodes: DagNode[];
}
