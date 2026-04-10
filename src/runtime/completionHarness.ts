import fs from "node:fs/promises";
import path from "node:path";

export type CompletionAcceptanceDecision = "accept" | "revise" | "reject" | "unverified";

export type CompletionRecord = {
  id: string;
  taskId: string;
  family: string;
  taskInput: string;
  finalState: "completed" | "aborted";
  deliveryStatus: string;
  acceptanceDecision: CompletionAcceptanceDecision;
  verifierSummary: string;
  artifactCount: number;
  verificationCount: number;
  successfulCompletion: boolean;
  countedAt: string;
};

export type FamilyCompletionSummary = {
  family: string;
  totalRuns: number;
  successfulRuns: number;
  acceptedRuns: number;
  blockedRuns: number;
  completionRate: number;
  acceptanceRate: number;
  latestTaskId?: string;
  latestVerifierSummary?: string;
};

export type ReleaseGateResult = {
  ready: boolean;
  requiredFamilies: string[];
  checkedFamilies: FamilyCompletionSummary[];
  reasons: string[];
};

export type CompletionObjectiveSummary = {
  id: string;
  label: string;
  family: string;
  completionRate: number;
  acceptanceRate: number;
  totalRuns: number;
  blockedRuns: number;
};

type CompletionHarness = ReturnType<typeof createCompletionHarness>;

export function createCompletionHarness(args: {
  repoRoot: string;
  requiredFamilies?: string[];
}) {
  const requiredFamilies = args.requiredFamilies ?? ["research_writing"];
  const harnessDir = path.join(args.repoRoot, "artifacts", "completion-harness");
  const ledgerPath = path.join(harnessDir, "records.json");

  return {
    async appendRecord(input: {
      taskId: string;
      family: string;
      taskInput: string;
      finalState: "completed" | "aborted";
      deliveryStatus: string;
      acceptanceDecision: CompletionAcceptanceDecision;
      verifierSummary: string;
      artifactCount: number;
      verificationCount: number;
    }) {
      const records = await readRecords(ledgerPath);
      const record: CompletionRecord = {
        id: crypto.randomUUID(),
        taskId: input.taskId,
        family: input.family,
        taskInput: input.taskInput,
        finalState: input.finalState,
        deliveryStatus: input.deliveryStatus,
        acceptanceDecision: input.acceptanceDecision,
        verifierSummary: input.verifierSummary,
        artifactCount: input.artifactCount,
        verificationCount: input.verificationCount,
        successfulCompletion: isSuccessfulCompletion(input),
        countedAt: new Date().toISOString()
      };

      records.push(record);
      await fs.mkdir(harnessDir, { recursive: true });
      await fs.writeFile(ledgerPath, JSON.stringify(records, null, 2));
      return record;
    },

    async listRecords() {
      return await readRecords(ledgerPath);
    },

    async summarizeFamilies() {
      const records = await readRecords(ledgerPath);
      return summarizeFamilies(records);
    },

    async evaluateReleaseGate() {
      const summaries = await this.summarizeFamilies();
      const reasons: string[] = [];

      for (const family of requiredFamilies) {
        const summary = summaries.find((entry) => entry.family === family);
        if (!summary || summary.acceptedRuns === 0) {
          reasons.push(`missing accepted completion evidence for ${family}`);
        }
      }

      return {
        ready: reasons.length === 0,
        requiredFamilies,
        checkedFamilies: summaries,
        reasons
      } satisfies ReleaseGateResult;
    },

    async inspect(taskId?: string) {
      const records = await readRecords(ledgerPath);
      const families = summarizeFamilies(records);
      const releaseGate = await this.evaluateReleaseGate();
      const latestRecord = taskId
        ? [...records].reverse().find((entry) => entry.taskId === taskId) ?? null
        : records.at(-1) ?? null;

      return {
        latestRecord,
        families,
        releaseGate
      };
    }
  };
}

export type CompletionHarnessStore = Pick<CompletionHarness, "appendRecord" | "inspect" | "evaluateReleaseGate">;

async function readRecords(ledgerPath: string): Promise<CompletionRecord[]> {
  try {
    const raw = await fs.readFile(ledgerPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed as CompletionRecord[] : [];
  } catch {
    return [];
  }
}

function summarizeFamilies(records: CompletionRecord[]): FamilyCompletionSummary[] {
  const families = new Map<string, CompletionRecord[]>();
  for (const record of records) {
    const entries = families.get(record.family) ?? [];
    entries.push(record);
    families.set(record.family, entries);
  }

  return [...families.entries()]
    .map(([family, entries]) => {
      const totalRuns = entries.length;
      const successfulRuns = entries.filter((entry) => entry.successfulCompletion).length;
      const acceptedRuns = entries.filter((entry) => entry.acceptanceDecision === "accept").length;
      const blockedRuns = entries.filter((entry) => entry.finalState !== "completed" || entry.deliveryStatus === "blocked").length;
      const latest = entries.at(-1);

      return {
        family,
        totalRuns,
        successfulRuns,
        acceptedRuns,
        blockedRuns,
        completionRate: totalRuns === 0 ? 0 : successfulRuns / totalRuns,
        acceptanceRate: totalRuns === 0 ? 0 : acceptedRuns / totalRuns,
        latestTaskId: latest?.taskId,
        latestVerifierSummary: latest?.verifierSummary
      } satisfies FamilyCompletionSummary;
    })
    .sort((left, right) => left.family.localeCompare(right.family));
}

export function summarizeCompletionObjectives(families: FamilyCompletionSummary[]): CompletionObjectiveSummary[] {
  return families.map((family) => ({
    id: `family:${family.family}`,
    label: family.family,
    family: family.family,
    completionRate: family.completionRate,
    acceptanceRate: family.acceptanceRate,
    totalRuns: family.totalRuns,
    blockedRuns: family.blockedRuns
  }));
}

function isSuccessfulCompletion(input: {
  finalState: "completed" | "aborted";
  deliveryStatus: string;
  acceptanceDecision: CompletionAcceptanceDecision;
}) {
  return input.finalState === "completed"
    && input.deliveryStatus === "completed"
    && (input.acceptanceDecision === "accept" || input.acceptanceDecision === "unverified");
}
