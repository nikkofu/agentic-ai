"use client";
import { useTaskStore } from "@/store/useTaskStore";

export function NodeInspector({ nodeId }: { nodeId: string | null }) {
  const node = useTaskStore((state) => nodeId ? state.nodes.find(n => n.id === nodeId) : null);

  if (!node) return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 p-6 text-gray-500 italic">
      Select a node to view details
    </div>
  );

  return (
    <div className="w-96 bg-gray-900 border-l border-gray-800 p-6 overflow-y-auto text-gray-200 shadow-2xl">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-blue-500" />
        Node Details
      </h2>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-500 uppercase font-bold">ID</label>
          <p className="font-mono text-sm break-all">{node.id}</p>
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase font-bold">Role</label>
          <p className="capitalize text-blue-300 font-semibold">{node.data.role}</p>
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase font-bold">Status</label>
          <span className="ml-2 px-2 py-0.5 rounded text-xs bg-gray-800 border border-gray-700 uppercase">
            {node.data.status}
          </span>
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase font-bold">Input Summary</label>
          <pre className="mt-1 p-3 bg-gray-950 rounded text-xs whitespace-pre-wrap border border-gray-800 max-h-40 overflow-y-auto">
            {node.data.inputSummary || "N/A"}
          </pre>
        </div>
        {node.data.outputSummary && (
          <div>
            <label className="text-xs text-gray-500 uppercase font-bold">Output Summary</label>
            <pre className="mt-1 p-3 bg-gray-950 rounded text-xs whitespace-pre-wrap border border-gray-800 max-h-60 overflow-y-auto text-green-300">
              {node.data.outputSummary}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
