import fs from "node:fs/promises";
import path from "node:path";
import { buildAcceptanceProof } from "./qaFindings";
import { computeResearchSourceCoverage } from "./researchWriting";
import type { FamilyDeliveryBundle, QaFinding, TaskFamilyPolicy, VerificationRecord } from "./contracts";

type ArtifactTruth = {
  path: string;
  exists: boolean;
  nonEmpty: boolean;
};

export async function auditFamilyDelivery(args: {
  delivery: FamilyDeliveryBundle;
  familyPolicy?: TaskFamilyPolicy;
}) {
  const artifacts = await inspectArtifacts(args.delivery.artifacts);
  if (args.delivery.family === "research_writing") {
    return auditResearchDelivery(args.delivery, artifacts, args.familyPolicy);
  }

  if (args.delivery.family === "browser_workflow") {
    return auditBrowserDelivery(args.delivery, artifacts, args.familyPolicy);
  }

  return {
    ...args.delivery,
    acceptance_proof: buildAcceptanceProof({
      decision: "accept",
      verifierSummary: "No family-specific verifier applied."
    })
  };
}

function auditResearchDelivery(
  delivery: FamilyDeliveryBundle,
  artifacts: ArtifactTruth[],
  familyPolicy?: TaskFamilyPolicy
): FamilyDeliveryBundle {
  const findings: QaFinding[] = [];
  const sourceCoverage = computeResearchSourceCoverage(delivery.verification);
  const referencesArtifact = artifacts.find((artifact) => /reference/i.test(artifact.path));
  const hasContentArtifact = artifacts.some((artifact) => artifact.nonEmpty && !/reference/i.test(artifact.path));

  if (familyPolicy?.requireArtifacts && !hasContentArtifact) {
    findings.push({
      severity: "critical",
      kind: "artifact_invalid",
      summary: "Final article artifact is missing or empty.",
      evidenceRefs: artifacts.map((artifact) => artifact.path)
    });
  }

  if (!referencesArtifact?.nonEmpty) {
    findings.push({
      severity: "critical",
      kind: "artifact_invalid",
      summary: "References artifact is missing or empty.",
      evidenceRefs: artifacts.map((artifact) => artifact.path)
    });
  }

  if (!delivery.verification.some((record) => record.kind === "source" && record.passed)) {
    findings.push({
      severity: "critical",
      kind: "verification_gap",
      summary: "No passing source verification is attached to the research delivery."
    });
  }

  if (typeof familyPolicy?.sourceCoverageMinimum === "number" && sourceCoverage < familyPolicy.sourceCoverageMinimum) {
    findings.push({
      severity: "major",
      kind: "claim_risk",
      summary: `Research delivery only verified ${sourceCoverage} distinct sources, below the required ${familyPolicy.sourceCoverageMinimum}.`
    });
  }

  const decision = findings.some((finding) => finding.severity === "critical") ? "reject" : findings.length > 0 ? "revise" : "accept";
  const blockingReason = delivery.blocking_reason ?? (
    decision === "accept"
      ? undefined
      : decision === "revise"
        ? "verifier_revision_required"
        : "verifier_rejected"
  );

  return {
    ...delivery,
    status: decision === "accept" ? delivery.status : "blocked",
    blocking_reason: blockingReason,
    next_actions: decision === "accept" ? delivery.next_actions : [
      ...(delivery.next_actions ?? []),
      "Address verifier findings before attempting final delivery again."
    ],
    acceptance_proof: buildAcceptanceProof({
      decision,
      findings,
      acceptedAt: decision === "accept" ? Date.now() : undefined,
      verifierSummary: decision === "accept"
        ? `Accepted research delivery with ${sourceCoverage} verified sources.`
        : `Research verifier found ${findings.length} issue(s).`
    })
  };
}

function auditBrowserDelivery(
  delivery: FamilyDeliveryBundle,
  artifacts: ArtifactTruth[],
  familyPolicy?: TaskFamilyPolicy
): FamilyDeliveryBundle {
  const findings: QaFinding[] = [];
  const steps = delivery.delivery_proof.steps;
  const validationStep = [...steps].reverse().find((step) => step.kind === "validate_outcome");
  const recoveryAttempts = delivery.delivery_proof.replayHints?.length ?? 0;
  const runSummaryArtifact = artifacts.find((artifact) => /run-summary/i.test(artifact.path));
  const stepsArtifact = artifacts.find((artifact) => /steps/i.test(artifact.path));

  if (familyPolicy?.requireArtifacts && (!runSummaryArtifact?.nonEmpty || !stepsArtifact?.nonEmpty)) {
    findings.push({
      severity: "critical",
      kind: "artifact_invalid",
      summary: "Browser execution proof artifacts are missing or empty.",
      evidenceRefs: artifacts.map((artifact) => artifact.path)
    });
  }

  const validationPassed = validationStep?.status === "completed";
  if (!validationPassed) {
    findings.push({
      severity: recoveryAttempts >= 2 ? "critical" : "major",
      kind: recoveryAttempts >= 2 ? "browser_recovery_exhausted" : "browser_outcome_mismatch",
      summary: validationStep?.summary || delivery.blocking_reason || "Browser outcome was not reached."
    });
  }

  const decision = findings.some((finding) => finding.severity === "critical") ? "reject" : findings.length > 0 ? "revise" : "accept";
  const blockingReason = delivery.blocking_reason ?? (
    decision === "accept"
      ? undefined
      : decision === "revise"
        ? "verifier_revision_required"
        : "verifier_rejected"
  );

  return {
    ...delivery,
    status: decision === "accept" ? delivery.status : "blocked",
    blocking_reason: blockingReason,
    next_actions: decision === "accept" ? delivery.next_actions : [
      ...(delivery.next_actions ?? []),
      "Retry the workflow with verifier findings applied before final handoff."
    ],
    acceptance_proof: buildAcceptanceProof({
      decision,
      findings,
      acceptedAt: decision === "accept" ? Date.now() : undefined,
      verifierSummary: decision === "accept"
        ? `Accepted browser workflow with ${steps.length} executed steps.`
        : `Browser verifier found ${findings.length} issue(s).`
    })
  };
}

async function inspectArtifacts(artifactPaths: string[]): Promise<ArtifactTruth[]> {
  return await Promise.all(
    artifactPaths.map(async (artifactPath) => {
      try {
        const stats = await fs.stat(path.resolve(artifactPath));
        return {
          path: artifactPath,
          exists: stats.isFile(),
          nonEmpty: stats.isFile() && stats.size > 0
        };
      } catch {
        return {
          path: artifactPath,
          exists: false,
          nonEmpty: false
        };
      }
    })
  );
}
