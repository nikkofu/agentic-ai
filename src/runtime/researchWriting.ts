import type { FamilyDeliveryBundle, VerificationRecord } from "./contracts";
import { archiveSupplementalArtifact } from "../core/deliveryArtifacts";

type ResearchReference = {
  sourceId: string;
  summary: string;
  locator?: string;
};

export function computeResearchSourceCoverage(records: VerificationRecord[]): number {
  return collectDistinctResearchReferences(records).length;
}

export function buildResearchReferencesArtifact(records: VerificationRecord[]): {
  content: string;
  preview: string[];
} {
  const references = collectDistinctResearchReferences(records);
  return {
    content: JSON.stringify(references, null, 2),
    preview: references.map((reference) => reference.summary).slice(0, 3)
  };
}

export async function finalizeResearchWritingDelivery(args: {
  taskId: string;
  taskInput: string;
  delivery: FamilyDeliveryBundle;
  artifactsRoot?: string;
}): Promise<FamilyDeliveryBundle> {
  if (args.delivery.family !== "research_writing") {
    return args.delivery;
  }

  const references = collectDistinctResearchReferences(args.delivery.verification);
  if (references.length === 0) {
    return args.delivery;
  }

  const artifactPath = await archiveSupplementalArtifact({
    taskId: args.taskId,
    taskInput: args.taskInput,
    suffix: "references.json",
    content: JSON.stringify(references, null, 2),
    artifactsRoot: args.artifactsRoot
  });

  return {
    ...args.delivery,
    artifacts: Array.from(new Set([...args.delivery.artifacts, artifactPath]))
  };
}

function collectDistinctResearchReferences(records: VerificationRecord[]): ResearchReference[] {
  const distinct = new Map<string, ResearchReference>();

  for (const record of records) {
    if (!record.passed || record.kind !== "source") {
      continue;
    }
    if (!record.sourceId || !record.sourceId.trim()) {
      continue;
    }
    if (distinct.has(record.sourceId)) {
      continue;
    }

    distinct.set(record.sourceId, {
      sourceId: record.sourceId,
      summary: record.summary,
      locator: record.locator
    });
  }

  return Array.from(distinct.values());
}
