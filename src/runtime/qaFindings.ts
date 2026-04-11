import type { AcceptanceProof, QaFinding, VerifierDecision } from "./contracts";

export function normalizeQaFindings(values: unknown): QaFinding[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.flatMap((value): QaFinding[] => {
    if (!value || typeof value !== "object") {
      return [];
    }

    const record = value as Partial<QaFinding>;
    if (typeof record.summary !== "string" || record.summary.trim().length === 0) {
      return [];
    }

    const severity = record.severity === "critical" || record.severity === "major" ? record.severity : "minor";
    const kind = normalizeFindingKind(record.kind);
    const evidenceRefs = Array.isArray(record.evidenceRefs)
      ? record.evidenceRefs.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [];

    return [{
      severity,
      kind,
      summary: record.summary,
      evidenceRefs,
      nodeId: typeof record.nodeId === "string" ? record.nodeId : undefined
    }];
  });
}

export function buildAcceptanceProof(args: {
  decision: VerifierDecision;
  findings?: QaFinding[];
  verifierSummary: string;
  acceptedAt?: number;
}): AcceptanceProof {
  return {
    decision: args.decision,
    acceptedAt: args.acceptedAt,
    findings: normalizeQaFindings(args.findings ?? []),
    verifierSummary: args.verifierSummary
  };
}

function normalizeFindingKind(value: unknown): QaFinding["kind"] {
  return value === "verification_gap"
    || value === "claim_risk"
    || value === "artifact_invalid"
    || value === "browser_outcome_mismatch"
    || value === "browser_recovery_exhausted"
    || value === "policy_violation"
    || value === "missing_comparison_target"
    || value === "missing_dimension_coverage"
    || value === "insufficient_evidence_mapping"
    || value === "weak_comparative_reasoning"
    || value === "non_actionable_recommendation"
    || value === "bundle_artifact_missing"
    || value === "draft_structure_invalid"
    || value === "missing_channel_variant"
    || value === "variant_message_mismatch"
    || value === "production_plan_invalid"
    || value === "missing_content_brief"
    ? value
    : "policy_violation";
}
