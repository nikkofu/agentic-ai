import type { DeliveryBundle } from "../types/runtime";
import type { DeliveryProof, DeliveryProofStep, FamilyDeliveryBundle, TaskFamily, TaskFamilyPolicy, VerificationRecord } from "./contracts";

export type { DeliveryProof, DeliveryProofStep, VerificationRecord } from "./contracts";

export function normalizeDeliveryProof(args: {
  family: TaskFamily;
  proof?: Partial<DeliveryProof> | null;
  delivery?: Partial<DeliveryBundle | FamilyDeliveryBundle> | null;
}): DeliveryProof {
  const proofSteps = normalizeProofSteps(args.proof?.steps);
  if (proofSteps.length > 0) {
    return {
      family: args.family,
      steps: proofSteps,
      replayHints: normalizeStrings(args.proof?.replayHints)
    };
  }

  return {
    family: args.family,
    steps: [buildDeliveryStep(args.delivery)],
    replayHints: normalizeStrings(args.proof?.replayHints)
  };
}

export function createFamilyDeliveryBundle(args: {
  family: TaskFamily;
  delivery: Partial<DeliveryBundle | FamilyDeliveryBundle>;
  proof?: DeliveryProof | null;
}): FamilyDeliveryBundle {
  const existingProof = "delivery_proof" in args.delivery ? (args.delivery as Partial<FamilyDeliveryBundle>).delivery_proof : undefined;
  const verification = normalizeVerificationRecords(args.delivery.verification);
  const baseArtifacts = Array.isArray(args.delivery.artifacts) ? args.delivery.artifacts.filter((value): value is string => typeof value === "string") : [];
  const baseRisks = Array.isArray(args.delivery.risks) ? args.delivery.risks.filter((value): value is string => typeof value === "string") : [];
  const baseNextActions = Array.isArray(args.delivery.next_actions) ? args.delivery.next_actions.filter((value): value is string => typeof value === "string") : [];

  return {
    status: args.delivery.status === "failed" || args.delivery.status === "blocked" || args.delivery.status === "partial"
      ? args.delivery.status
      : "completed",
    final_result: typeof args.delivery.final_result === "string" ? args.delivery.final_result : "",
    artifacts: baseArtifacts,
    verification,
    risks: baseRisks,
    blocking_reason: typeof args.delivery.blocking_reason === "string" ? args.delivery.blocking_reason : undefined,
    next_actions: baseNextActions,
    family: args.family,
    delivery_proof: args.proof ?? existingProof ?? normalizeDeliveryProof({
      family: args.family,
      delivery: {
        ...args.delivery,
        verification
      }
    })
  };
}

export function applyFamilyDeliveryPolicy(args: {
  delivery: FamilyDeliveryBundle;
  familyPolicy?: TaskFamilyPolicy;
}): FamilyDeliveryBundle {
  const { delivery, familyPolicy } = args;
  if (!familyPolicy) {
    return delivery;
  }

  if (familyPolicy.requireVerification && !hasPassingVerificationRecords(delivery.verification)) {
    return {
      ...delivery,
      status: "blocked",
      blocking_reason: "policy_verification_required"
    };
  }

  if (familyPolicy.requireArtifacts && delivery.artifacts.length === 0) {
    return {
      ...delivery,
      status: "blocked",
      blocking_reason: "policy_artifacts_required"
    };
  }

  if (
    typeof familyPolicy.sourceCoverageMinimum === "number" &&
    familyPolicy.sourceCoverageMinimum > 0 &&
    countPassingSourceRecords(delivery.verification) < familyPolicy.sourceCoverageMinimum
  ) {
    return {
      ...delivery,
      status: "blocked",
      blocking_reason: "policy_source_coverage_required"
    };
  }

  return delivery;
}

export function hasPassingVerificationRecords(records: VerificationRecord[]): boolean {
  return records.some((record) => record.passed);
}

function countPassingSourceRecords(records: VerificationRecord[]): number {
  return records.filter((record) => record.passed && record.kind === "source").length;
}

function buildDeliveryStep(delivery?: Partial<DeliveryBundle | FamilyDeliveryBundle> | null): DeliveryProofStep {
  const status = delivery?.status === "failed"
    ? "failed"
    : delivery?.status === "blocked"
      ? "blocked"
      : "completed";
  const blockingReason = typeof delivery?.blocking_reason === "string" ? delivery.blocking_reason : "";
  const finalResult = typeof delivery?.final_result === "string" ? delivery.final_result : "";
  const summary = blockingReason.trim().length > 0
    ? blockingReason
    : finalResult.trim().length > 0
      ? finalResult.slice(0, 160)
      : "delivery";
  const evidenceRefs = [
    ...collectVerificationEvidence(delivery?.verification),
    ...normalizeStrings(Array.isArray(delivery?.artifacts) ? delivery.artifacts : [])
  ];

  return {
    kind: "delivery",
    status,
    summary,
    evidenceRefs
  };
}

function normalizeProofSteps(steps: unknown): DeliveryProofStep[] {
  if (!Array.isArray(steps)) {
    return [];
  }

  return steps
    .map((step): DeliveryProofStep | null => {
      if (!step || typeof step !== "object") {
        return null;
      }

      const rawKind = (step as { kind?: unknown }).kind;
      const kind = typeof rawKind === "string" && rawKind.trim().length > 0 ? rawKind : "step";
      const status = normalizeStatus((step as { status?: unknown }).status);
      const summary = typeof (step as { summary?: unknown }).summary === "string"
        ? String((step as { summary?: string }).summary)
        : "";

      return {
        kind,
        status,
        summary,
        evidenceRefs: normalizeStrings((step as { evidenceRefs?: unknown }).evidenceRefs)
      };
    })
    .filter((step): step is DeliveryProofStep => step !== null);
}

function normalizeVerificationRecords(values: unknown): VerificationRecord[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value): VerificationRecord | null => {
      if (typeof value === "string") {
        return {
          kind: "source",
          summary: value,
          sourceId: value,
          passed: true
        };
      }

      if (!value || typeof value !== "object") {
        return null;
      }

      const kind = normalizeVerificationKind((value as { kind?: unknown }).kind);
      const summary = typeof (value as { summary?: unknown }).summary === "string"
        ? (value as { summary: string }).summary
        : "";
      const passed = (value as { passed?: unknown }).passed === true;
      const sourceId = typeof (value as { sourceId?: unknown }).sourceId === "string"
        ? (value as { sourceId: string }).sourceId
        : undefined;
      const locator = typeof (value as { locator?: unknown }).locator === "string"
        ? (value as { locator: string }).locator
        : undefined;

      if (!summary.trim()) {
        return null;
      }

      return {
        kind,
        summary,
        passed,
        sourceId,
        locator
      };
    })
    .filter((value): value is VerificationRecord => value !== null);
}

function normalizeVerificationKind(value: unknown): VerificationRecord["kind"] {
  return value === "page_state" || value === "form_result" || value === "artifact_check" ? value : "source";
}

function collectVerificationEvidence(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.flatMap((value) => {
    if (typeof value === "string") {
      return [value];
    }
    if (!value || typeof value !== "object") {
      return [];
    }
    const record = value as Partial<VerificationRecord>;
    return [
      typeof record.sourceId === "string" ? record.sourceId : "",
      typeof record.locator === "string" ? record.locator : "",
      typeof record.summary === "string" ? record.summary : ""
    ].filter((entry): entry is string => entry.trim().length > 0);
  }).filter((value, index, array) => array.indexOf(value) === index);
}

function normalizeStatus(value: unknown): DeliveryProofStep["status"] {
  return value === "failed" || value === "blocked" ? value : "completed";
}

function normalizeStrings(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}
