import fs from "node:fs/promises";
import path from "node:path";

import type { FamilyDeliveryBundle } from "./contracts";

type ChannelVariant = {
  channel: string;
  format: string;
  summary: string;
  content: string;
  source_anchor: string;
};

type ContentPackageSections = {
  objective: string;
  audience: string;
  keyMessage: string;
  outline: string[];
  primaryDraft: string[];
  channelVariants: ChannelVariant[];
  nextSteps: string[];
  distributionTargets: string[];
  handoffChecks: string[];
};

export type ContentPackageSummary = {
  objective: string;
  audience: string;
  keyMessage: string;
  variantCount: number;
  productionStepCount: number;
  bundleComplete: boolean;
};

export function buildOutlineArtifact(report: string): {
  content: string;
  preview: string[];
} {
  const parsed = parseContentReport(report);
  const content = [
    "# Content Outline",
    "",
    "## Objective",
    parsed.objective,
    "",
    "## Audience",
    parsed.audience,
    "",
    "## Key Message",
    parsed.keyMessage,
    "",
    "## Outline",
    ...parsed.outline.map((item) => `- ${item}`)
  ].join("\n");

  return {
    content,
    preview: parsed.outline.slice(0, 3)
  };
}

export function buildPrimaryDraftArtifact(report: string): {
  content: string;
  preview: string[];
} {
  const parsed = parseContentReport(report);
  return {
    content: parsed.primaryDraft.join("\n"),
    preview: parsed.primaryDraft.filter((line) => line.trim().length > 0).slice(0, 3)
  };
}

export function buildChannelVariantsArtifact(report: string): {
  content: string;
  preview: string[];
} {
  const parsed = parseContentReport(report);
  return {
    content: JSON.stringify(parsed.channelVariants, null, 2),
    preview: parsed.channelVariants.map((variant) => variant.channel).slice(0, 3)
  };
}

export function buildProductionPlanArtifact(report: string): {
  content: string;
  preview: string[];
} {
  const parsed = parseContentReport(report);
  return {
    content: JSON.stringify({
      objective: parsed.objective,
      audience: parsed.audience,
      key_messages: parsed.keyMessage ? [parsed.keyMessage] : [],
      next_steps: parsed.nextSteps,
      distribution_targets: parsed.distributionTargets,
      handoff_checks: parsed.handoffChecks
    }, null, 2),
    preview: parsed.nextSteps.slice(0, 3)
  };
}

export function summarizeContentPackage(args: {
  report: string;
  artifacts?: string[];
}): ContentPackageSummary {
  const parsed = parseContentReport(args.report);
  return {
    objective: parsed.objective,
    audience: parsed.audience,
    keyMessage: parsed.keyMessage,
    variantCount: parsed.channelVariants.length,
    productionStepCount: parsed.nextSteps.length,
    bundleComplete: hasContentBundleArtifacts(args.artifacts ?? [])
  };
}

export async function finalizeContentPipelineDelivery(args: {
  taskId: string;
  taskInput: string;
  delivery: FamilyDeliveryBundle;
  artifactsRoot?: string;
}): Promise<FamilyDeliveryBundle> {
  if (args.delivery.family !== "content_pipeline") {
    return args.delivery;
  }

  const report = args.delivery.final_result.trim();
  if (!report) {
    return args.delivery;
  }

  const artifactsRoot = path.resolve(args.artifactsRoot ?? "artifacts");
  await fs.mkdir(artifactsRoot, { recursive: true });

  const outlinePath = await writeContentArtifact(
    artifactsRoot,
    args.taskId,
    "outline.md",
    buildOutlineArtifact(report).content
  );
  const primaryDraftPath = await writeContentArtifact(
    artifactsRoot,
    args.taskId,
    "primary-draft.md",
    buildPrimaryDraftArtifact(report).content
  );
  const channelVariantsPath = await writeContentArtifact(
    artifactsRoot,
    args.taskId,
    "channel-variants.json",
    buildChannelVariantsArtifact(report).content
  );
  const productionPlanPath = await writeContentArtifact(
    artifactsRoot,
    args.taskId,
    "production-plan.json",
    buildProductionPlanArtifact(report).content
  );

  return {
    ...args.delivery,
    artifacts: Array.from(new Set([
      ...args.delivery.artifacts,
      outlinePath,
      primaryDraftPath,
      channelVariantsPath,
      productionPlanPath
    ]))
  };
}

function parseContentReport(report: string): ContentPackageSections {
  const sections = splitMarkdownSections(report);

  return {
    objective: firstMeaningfulLine(sections.get("objective") ?? []),
    audience: firstMeaningfulLine(sections.get("audience") ?? []),
    keyMessage: firstMeaningfulLine(sections.get("key message") ?? []),
    outline: normalizeBullets(sections.get("outline") ?? []),
    primaryDraft: normalizeParagraphs(sections.get("primary draft") ?? []),
    channelVariants: parseChannelVariants(sections.get("channel variants") ?? []),
    nextSteps: collectPrefixedValues(sections.get("production plan") ?? [], "next_step"),
    distributionTargets: collectPrefixedValues(sections.get("production plan") ?? [], "distribution_target"),
    handoffChecks: collectPrefixedValues(sections.get("production plan") ?? [], "handoff_check")
  };
}

function splitMarkdownSections(report: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let current = "";

  for (const line of report.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.*)$/);
    if (heading) {
      current = heading[1].trim().toLowerCase();
      sections.set(current, []);
      continue;
    }

    if (!current) {
      continue;
    }

    sections.get(current)?.push(line);
  }

  return sections;
}

function normalizeBullets(lines: string[]): string[] {
  return lines
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter((line) => line.length > 0);
}

function normalizeParagraphs(lines: string[]): string[] {
  return lines
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
}

function firstMeaningfulLine(lines: string[]): string {
  return normalizeParagraphs(lines)[0]?.trim() ?? "";
}

function parseChannelVariants(lines: string[]): ChannelVariant[] {
  const variants: ChannelVariant[] = [];
  let current: Partial<ChannelVariant> | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const channelMatch = line.match(/^- channel:\s*(.*)$/);
    if (channelMatch) {
      if (current?.channel && current.format && current.summary && current.content && current.source_anchor) {
        variants.push(current as ChannelVariant);
      }
      current = {
        channel: channelMatch[1].trim()
      };
      continue;
    }

    const fieldMatch = line.match(/^(format|summary|content|source_anchor):\s*(.*)$/);
    if (!fieldMatch || !current) {
      continue;
    }

    const [, key, value] = fieldMatch;
    current[key as keyof ChannelVariant] = value.trim() as never;
  }

  if (current?.channel && current.format && current.summary && current.content && current.source_anchor) {
    variants.push(current as ChannelVariant);
  }

  return variants;
}

function collectPrefixedValues(lines: string[], key: string): string[] {
  const pattern = new RegExp(`^-\\s*${key}:\\s*(.*)$`);
  return lines
    .map((line) => line.trim())
    .map((line) => line.match(pattern)?.[1]?.trim() ?? "")
    .filter((line) => line.length > 0);
}

async function writeContentArtifact(
  artifactsRoot: string,
  taskId: string,
  suffix: string,
  content: string
): Promise<string> {
  const fileName = `${sanitizeArtifactBaseName(taskId)}-${suffix}`;
  const artifactPath = path.join(artifactsRoot, fileName);
  await fs.writeFile(artifactPath, content, "utf8");
  return path.relative(process.cwd(), artifactPath).replace(/\\/g, "/");
}

function sanitizeArtifactBaseName(taskId: string): string {
  const normalized = taskId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "content-package";
}

function hasContentBundleArtifacts(artifacts: string[]): boolean {
  const lowerArtifacts = artifacts.map((artifact) => artifact.toLowerCase());
  return lowerArtifacts.some((artifact) => artifact.endsWith("-outline.md"))
    && lowerArtifacts.some((artifact) => artifact.endsWith("-primary-draft.md"))
    && lowerArtifacts.some((artifact) => artifact.endsWith("-channel-variants.json"))
    && lowerArtifacts.some((artifact) => artifact.endsWith("-production-plan.json"));
}
