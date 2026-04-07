export type LocalTool = {
  name: string;
  run: (input: unknown) => Promise<unknown> | unknown;
};

export type LocalToolRegistry = {
  get: (name: string) => LocalTool | undefined;
};

export function createLocalToolRegistry(tools: LocalTool[]): LocalToolRegistry {
  const index = new Map(tools.map((tool) => [tool.name, tool]));

  return {
    get(name: string) {
      return index.get(name);
    }
  };
}
