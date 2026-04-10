import fs from "node:fs/promises";
import path from "node:path";

import { resolveMemoryRoot } from "./memoryPaths";

export type SkillCandidate = {
  id: string;
  sourceEntryIds: string[];
  summary: string;
  procedure: string[];
  confidence: "low" | "medium" | "high";
  status: "candidate" | "approved" | "rejected" | "published";
};

type SkillCandidateState = {
  candidates: SkillCandidate[];
};

export function createSkillEvolution(args: {
  repoRoot: string;
}) {
  const roots = resolveMemoryRoot(args.repoRoot, process.env.HOME ?? "");
  const filePath = path.join(roots.indexRoot, "skill-candidates.json");

  const readState = async (): Promise<SkillCandidateState> => {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as SkillCandidateState;
      return {
        candidates: Array.isArray(parsed.candidates) ? parsed.candidates : []
      };
    } catch {
      return { candidates: [] };
    }
  };

  const writeState = async (state: SkillCandidateState) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(state, null, 2), "utf8");
  };

  return {
    async recordCandidates(candidates: SkillCandidate[]) {
      const state = await readState();
      const seen = new Map(state.candidates.map((candidate) => [candidate.id, candidate] as const));
      for (const candidate of candidates) {
        seen.set(candidate.id, candidate);
      }
      state.candidates = [...seen.values()];
      await writeState(state);
      return candidates;
    },

    async listCandidates() {
      const state = await readState();
      return state.candidates;
    }
  };
}
