"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useEventStream } from "@/hooks/useEventStream";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { GraphCanvas } from "@/components/GraphCanvas";
import { MetricsSummary } from "@/components/MetricsSummary";

function DashboardContent() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get("taskId");
  const { status, details, reconnect } = useEventStream(taskId);

  return (
    <div className="flex flex-col h-screen w-full bg-black overflow-hidden">
      <ConnectionBanner taskId={taskId} status={status} details={details} onReconnect={reconnect} />
      <MetricsSummary />
      <div className="flex-1 relative">
        <GraphCanvas />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="bg-black text-white p-10 h-screen w-full">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
