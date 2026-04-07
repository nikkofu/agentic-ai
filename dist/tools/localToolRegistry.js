export function createLocalToolRegistry(tools) {
    const index = new Map(tools.map((tool) => [tool.name, tool]));
    return {
        get(name) {
            return index.get(name);
        }
    };
}
