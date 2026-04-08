export type PlannerPolicy = {
  recommendedTools: string[];
  requiredCapabilities: string[];
  verificationPolicy: string;
};

export function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}
