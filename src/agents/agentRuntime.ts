type SimulatedRunArgs = {
  forceGuardrailTrip?: boolean;
};

export function createAgentRuntime() {
  return {
    async run(_args?: SimulatedRunArgs) {
      return {
        usedTool: true,
        evaluation: "pass"
      } as const;
    }
  };
}
