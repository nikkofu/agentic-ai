"use client";

type OperatorDeepViewPanelProps = {
  inspection: {
    finalDelivery?: {
      verifierSummary?: string;
      verificationPreview?: string[];
      findingsPreview?: string[];
      artifacts?: Array<{
        path: string;
        exists: boolean;
        nonEmpty: boolean;
      }>;
    } | null;
    plan?: {
      nodeCount: number;
      latestJoinDecision: string;
      activeNodePath: string;
    } | null;
  } | null;
  initialTab?: "runtime" | "evidence" | "events";
};

const TABS = [
  "Node Graph",
  "Tool Calls",
  "Event Stream",
  "Verifier Findings",
  "Artifact Truth",
  "Lifecycle / Replay / Resume"
] as const;

export function OperatorDeepViewPanel({ inspection, initialTab = "runtime" }: OperatorDeepViewPanelProps) {
  return (
    <div className="rounded border border-white/10 bg-black/30 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Operator Layer</div>
          <div className="text-sm text-neutral-200">Codex-like runtime drilldown for graph, tools, events, and delivery proof.</div>
        </div>
        <div className="text-xs text-neutral-500">{`initial=${initialTab}`}</div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <div key={tab} className="rounded border border-white/10 px-2 py-1 text-xs text-neutral-300">
            {tab}
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3 text-xs text-neutral-300">
        <div className="rounded border border-white/10 p-2">
          <div className="mb-1 text-neutral-500">Plan</div>
          <div>{`nodes=${inspection?.plan?.nodeCount ?? 0}`}</div>
          <div>{`active=${inspection?.plan?.activeNodePath ?? "n/a"}`}</div>
        </div>
        <div className="rounded border border-white/10 p-2">
          <div className="mb-1 text-neutral-500">Verifier Findings</div>
          <div>{inspection?.finalDelivery?.verifierSummary ?? "no verifier summary"}</div>
          <div>{(inspection?.finalDelivery?.findingsPreview ?? []).join(", ") || "no findings"}</div>
        </div>
        <div className="rounded border border-white/10 p-2">
          <div className="mb-1 text-neutral-500">Artifact Truth</div>
          <div>
            {(inspection?.finalDelivery?.artifacts ?? [])
              .map((artifact) => `${artifact.path}:${artifact.exists ? (artifact.nonEmpty ? "ok" : "empty") : "missing"}`)
              .join(", ") || "no artifacts"}
          </div>
        </div>
      </div>
    </div>
  );
}
