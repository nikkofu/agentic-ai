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
    skillCandidates: Array<{
      id: string;
      sourceEntryIds: string[];
      summary: string;
      procedure: string[];
      confidence: "low" | "medium" | "high";
      status: "candidate" | "approved" | "rejected" | "published";
    }>;
    externalActionsAttempted: number;
  }>;
};

export function createDreamScheduler(args: {
  dreamRuntime: DreamRuntimeLike;
  thresholdMinutes: number;
  skillEvolution?: {
    recordCandidates: (candidates: Array<{
      id: string;
      sourceEntryIds: string[];
      summary: string;
      procedure: string[];
      confidence: "low" | "medium" | "high";
      status: "candidate" | "approved" | "rejected" | "published";
    }>) => Promise<unknown>;
  };
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

      const result = await args.dreamRuntime.runIdleCycle(input);
      if (result.skillCandidates.length > 0) {
        await args.skillEvolution?.recordCandidates(result.skillCandidates);
      }
      return result;
    }
  };
}
