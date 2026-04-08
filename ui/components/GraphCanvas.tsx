"use client";
import React, { useCallback, useState, useMemo } from 'react';
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

// Define static objects outside the component to avoid React Flow warnings
const nodeTypes = {};
const edgeTypes = {};
const minimapStyle = { background: '#111' };

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
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
        >
          <Background color="#222" gap={20} />
          <Controls />
          <MiniMap style={minimapStyle} nodeColor={() => '#333'} />
        </ReactFlow>
      </div>
      <NodeInspector nodeId={selectedNodeId} />
    </div>
  );
}
