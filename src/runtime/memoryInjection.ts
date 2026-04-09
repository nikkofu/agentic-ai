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
  const personal = (input.personalCompressed ?? []).map((entry) => `personal:${entry.id}:${entry.body}`);
  const project = (input.projectCompressed ?? []).map((entry) => `project:${entry.id}:${entry.body}`);
  const task = (input.taskCurated ?? []).map((entry) => `task:${entry.id}:${entry.body}`);

  return {
    personal,
    project,
    task,
    combined: [...personal, ...project, ...task]
  };
}
