type MemoryPanelProps = {
  inspection: {
    memory: {
      personal: { count: number; latest: string[] };
      project: { count: number; latest: string[] };
      task: { count: number; latest: string[] };
    };
    dream: {
      reflectionsCount: number;
      latestReflections: string[];
      recommendationsCount: number;
      latestRecommendations: string[];
    };
  };
};

export function MemoryPanel({ inspection }: MemoryPanelProps) {
  return (
    <div className="rounded border border-white/10 bg-black/30 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Memory</div>
      <MemorySection title="Personal Memory" count={inspection.memory.personal.count} entries={inspection.memory.personal.latest} />
      <MemorySection title="Project Memory" count={inspection.memory.project.count} entries={inspection.memory.project.latest} />
      <MemorySection title="Task Memory" count={inspection.memory.task.count} entries={inspection.memory.task.latest} />
      <MemorySection title="Dream" count={inspection.dream.reflectionsCount + inspection.dream.recommendationsCount} entries={[
        ...inspection.dream.latestReflections,
        ...inspection.dream.latestRecommendations
      ]} />
    </div>
  );
}

function MemorySection(props: {
  title: string;
  count: number;
  entries: string[];
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">{props.title}</div>
      <div className="font-mono text-[11px] text-neutral-200">count={props.count}</div>
      {props.entries.map((entry) => (
        <div key={`${props.title}-${entry}`} className="font-mono text-[11px] text-neutral-300 break-all">
          {entry}
        </div>
      ))}
    </div>
  );
}
