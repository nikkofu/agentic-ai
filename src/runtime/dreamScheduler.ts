type DreamRuntimeLike = {
  runIdleCycle: (input: {
    idleMinutes: number;
    taskFailures: string[];
    memoryEntries: Array<{
      id: string;
      body: string;
    }>;
  }) => Promise<{
    reflections: string[];
    hypotheses: string[];
    recommendations: string[];
    skillDrafts: string[];
    externalActionsAttempted: number;
  }>;
};

export function createDreamScheduler(args: {
  dreamRuntime: DreamRuntimeLike;
  thresholdMinutes: number;
}) {
  return {
    async maybeRunIdleCycle(input: {
      idleMinutes: number;
      taskFailures: string[];
      memoryEntries: Array<{
        id: string;
        body: string;
      }>;
    }) {
      if (input.idleMinutes < args.thresholdMinutes) {
        return null;
      }

      return await args.dreamRuntime.runIdleCycle(input);
    }
  };
}
