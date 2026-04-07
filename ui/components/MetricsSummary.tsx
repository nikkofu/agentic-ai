"use client";
import { useTaskStore } from "@/store/useTaskStore";

export function MetricsSummary() {
  const metrics = useTaskStore((state) => state.metrics);
  return (
    <div className="flex gap-6 p-4 bg-gray-900 border-b border-gray-800 text-white shadow-xl">
      <div className="flex flex-col">
        <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Total Tokens</span>
        <span className="text-2xl font-mono text-green-400">{metrics.totalTokens.toLocaleString()}</span>
      </div>
      <div className="flex flex-col border-l border-gray-700 pl-6">
        <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Total Cost</span>
        <span className="text-2xl font-mono text-blue-400">${metrics.totalCost.toFixed(6)}</span>
      </div>
    </div>
  );
}
