import fs from "node:fs/promises";
import path from "node:path";

import { resolveMemoryRoot } from "./memoryPaths";

type DreamInput = {
  idleMinutes: number;
  taskFailures: string[];
  memoryEntries: Array<{
    id: string;
    body: string;
  }>;
};

export function createDreamRuntime(args: {
  repoRoot: string;
  userHome: string;
}) {
  const roots = resolveMemoryRoot(args.repoRoot, args.userHome);

  const writeDreamArtifacts = async (folder: string, prefix: string, values: string[]) => {
    const dir = path.join(roots.dreamRoot, folder);
    await fs.mkdir(dir, { recursive: true });
    await Promise.all(values.map((value, index) => fs.writeFile(
      path.join(dir, `${prefix}-${index + 1}.md`),
      value,
      "utf8"
    )));
  };

  return {
    async runIdleCycle(input: DreamInput) {
      if (input.idleMinutes <= 0) {
        return {
          reflections: [],
          hypotheses: [],
          recommendations: [],
          skillDrafts: [],
          externalActionsAttempted: 0
        };
      }

      const reflections = [
        `Idle reflection after ${input.idleMinutes} minutes.`,
        ...input.taskFailures.map((failure) => `Observed repeated failure: ${failure}`)
      ];
      const hypotheses = input.taskFailures.length > 0
        ? [`Hypothesis: reduce repeated failures by improving pre-validation for ${input.taskFailures[0]}.`]
        : [];
      const recommendations = input.taskFailures.length > 0
        ? [`Recommendation: add a guard or verifier check for ${input.taskFailures[0]}.`]
        : ["Recommendation: continue compressing memory and refining successful procedures."];
      const skillDrafts = input.memoryEntries.length > 0
        ? [`Skill draft from ${input.memoryEntries[0].id}: ${input.memoryEntries[0].body}`]
        : ["Skill draft: summarize reusable recovery and verification workflows."];

      await writeDreamArtifacts("reflections", "reflection", reflections);
      await writeDreamArtifacts("hypotheses", "hypothesis", hypotheses);
      await writeDreamArtifacts("recommendations", "recommendation", recommendations);
      await writeDreamArtifacts("skills", "skill", skillDrafts);

      return {
        reflections,
        hypotheses,
        recommendations,
        skillDrafts,
        externalActionsAttempted: 0
      };
    }
  };
}
