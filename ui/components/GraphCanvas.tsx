"use client";
import React, { useCallback, useState } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap,
  Node,
  Edge
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useTaskStore } from '@/store/useTaskStore';
import { NodeInspector } from './NodeInspector';

export function GraphCanvas() {
  const { nodes, edges } = useTaskStore();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  return (
    <div className="flex-1 flex h-screen bg-black overflow-hidden">
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          fitView
        >
          <Background color="#222" gap={20} />
          <Controls />
          <MiniMap style={{ background: '#111' }} nodeColor={() => '#333'} />
        </ReactFlow>
      </div>
      <NodeInspector nodeId={selectedNodeId} />
    </div>
  );
}
