type InjectionEntry = {
  id: string;
  body: string;
};

export function buildMemoryInjectionSet(input: {
  personalCompressed?: InjectionEntry[];
  projectCompressed?: InjectionEntry[];
  taskCurated?: InjectionEntry[];
  taskRaw?: InjectionEntry[];
}) {
  const seenBodies = new Set<string>();
  const personal = injectLayer("personal", input.personalCompressed ?? [], seenBodies);
  const project = injectLayer("project", input.projectCompressed ?? [], seenBodies);
  const task = injectLayer("task", input.taskCurated ?? [], seenBodies);

  return {
    personal,
    project,
    task,
    combined: [...personal, ...project, ...task]
  };
}

function injectLayer(prefix: "personal" | "project" | "task", entries: InjectionEntry[], seenBodies: Set<string>) {
  const injected: string[] = [];
  for (const entry of entries) {
    const normalizedBody = entry.body.trim();
    if (!normalizedBody || seenBodies.has(normalizedBody)) {
      continue;
    }
    seenBodies.add(normalizedBody);
    injected.push(`${prefix}:${entry.id}:${entry.body}`);
  }
  return injected;
}
