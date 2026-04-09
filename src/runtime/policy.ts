export type { PlannerPolicy } from "./contracts";

export function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function normalizePlannerPolicy(value: {
  recommended_tools?: unknown;
  required_capabilities?: unknown;
  verification_policy?: unknown;
  max_revisions?: unknown;
  require_artifacts?: unknown;
}) {
  return {
    recommendedTools: normalizeStringList(value.recommended_tools),
    requiredCapabilities: normalizeStringList(value.required_capabilities),
    verificationPolicy:
      typeof value.verification_policy === "string" ? value.verification_policy : "",
    maxRevisions:
      typeof value.max_revisions === "number" && Number.isInteger(value.max_revisions) && value.max_revisions >= 0
        ? value.max_revisions
        : undefined,
    requireArtifacts: value.require_artifacts === true
  };
}
