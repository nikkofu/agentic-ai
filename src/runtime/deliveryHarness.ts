import type { DeliveryBundle } from "../types/runtime";
import type { DeliveryProof, DeliveryProofStep, TaskFamily } from "./contracts";

export type { DeliveryProof, DeliveryProofStep } from "./contracts";

export function normalizeDeliveryProof(args: {
  family: TaskFamily;
  proof?: Partial<DeliveryProof> | null;
  delivery?: Partial<DeliveryBundle> | null;
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

function buildDeliveryStep(delivery?: Partial<DeliveryBundle> | null): DeliveryProofStep {
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
  const evidenceRefs = normalizeStrings([
    ...(Array.isArray(delivery?.verification) ? delivery.verification : []),
    ...(Array.isArray(delivery?.artifacts) ? delivery.artifacts : [])
  ]);

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

function normalizeStatus(value: unknown): DeliveryProofStep["status"] {
  return value === "failed" || value === "blocked" ? value : "completed";
}

function normalizeStrings(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}
