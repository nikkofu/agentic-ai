import fs from "node:fs/promises";
import path from "node:path";

import type { FamilyDeliveryBundle, VerificationRecord } from "./contracts";

type CompetitiveReference = {
  sourceId: string;
  summary: string;
  locator?: string;
};

type CompetitiveReportSections = {
  subject: string;
  comparisonTargets: string[];
  comparisonDimensions: string[];
  executiveSummary: string[];
  keyFindings: string[];
  recommendations: string[];
};

export type CompetitiveResearchSummary = CompetitiveReportSections & {
  bundleComplete: boolean;
};

export function computeCompetitiveSourceCoverage(records: VerificationRecord[]): number {
  return collectDistinctCompetitiveReferences(records).length;
}

export function buildCompetitiveReferencesArtifact(records: VerificationRecord[]): {
  content: string;
  preview: string[];
} {
  const references = collectDistinctCompetitiveReferences(records);
  return {
    content: JSON.stringify(references, null, 2),
    preview: references.map((reference) => reference.summary).slice(0, 3)
  };
}

export function buildCompetitiveComparisonArtifact(report: string): {
  content: string;
  preview: string[];
} {
  const sections = parseCompetitiveReport(report);
  return {
    content: JSON.stringify({
      subject: sections.subject,
      comparisonTargets: sections.comparisonTargets,
      comparisonDimensions: sections.comparisonDimensions,
      keyFindings: sections.keyFindings,
      recommendations: sections.recommendations
    }, null, 2),
    preview: [
      `${sections.comparisonTargets.length} targets`,
      `${sections.comparisonDimensions.length} dimensions`,
      `${sections.keyFindings.length} findings`
    ]
  };
}

export function buildCompetitiveSummaryArtifact(report: string): {
  content: string;
  preview: string[];
} {
  const sections = parseCompetitiveReport(report);
  const content = [
    "# Competitive Research Summary",
    "",
    "## Executive Summary",
    ...sections.executiveSummary,
    "",
    "## Recommendations",
    ...sections.recommendations.map((item) => `- ${item}`)
  ].join("\n");

  return {
    content,
    preview: sections.executiveSummary.slice(0, 2)
  };
}

export function summarizeCompetitiveResearchReport(args: {
  report: string;
  artifacts?: string[];
}): CompetitiveResearchSummary {
  const sections = parseCompetitiveReport(args.report);
  return {
    ...sections,
    bundleComplete: hasCompetitiveBundleArtifacts(args.artifacts ?? [])
  };
}

export async function finalizeCompetitiveResearchDelivery(args: {
  taskId: string;
  taskInput: string;
  delivery: FamilyDeliveryBundle;
  artifactsRoot?: string;
}): Promise<FamilyDeliveryBundle> {
  if (args.delivery.family !== "competitive_research") {
    return args.delivery;
  }

  const report = args.delivery.final_result.trim();
  if (!report) {
    return args.delivery;
  }

  const artifactsRoot = path.resolve(args.artifactsRoot ?? "artifacts");
  await fs.mkdir(artifactsRoot, { recursive: true });

  const reportPath = await writeCompetitiveArtifact(artifactsRoot, args.taskId, "report.md", report);
  const summaryArtifact = buildCompetitiveSummaryArtifact(report);
  const summaryPath = await writeCompetitiveArtifact(artifactsRoot, args.taskId, "summary.md", summaryArtifact.content);
  const comparisonArtifact = buildCompetitiveComparisonArtifact(report);
  const comparisonPath = await writeCompetitiveArtifact(artifactsRoot, args.taskId, "comparison.json", comparisonArtifact.content);
  const referencesArtifact = buildCompetitiveReferencesArtifact(args.delivery.verification);
  const referencesPath = await writeCompetitiveArtifact(artifactsRoot, args.taskId, "references.json", referencesArtifact.content);

  return {
    ...args.delivery,
    artifacts: Array.from(new Set([
      ...args.delivery.artifacts,
      reportPath,
      summaryPath,
      comparisonPath,
      referencesPath
    ]))
  };
}

function parseCompetitiveReport(report: string): CompetitiveReportSections {
  const sections = splitMarkdownSections(report);
  return {
    subject: firstMeaningfulLine(sections.get("subject") ?? []),
    comparisonTargets: normalizeBullets(sections.get("comparison targets") ?? []),
    comparisonDimensions: normalizeBullets(sections.get("comparison dimensions") ?? []),
    executiveSummary: normalizeParagraphs(sections.get("executive summary") ?? []),
    keyFindings: normalizeBullets(sections.get("key findings") ?? []),
    recommendations: normalizeBullets(sections.get("recommendations") ?? [])
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
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function firstMeaningfulLine(lines: string[]): string {
  return normalizeParagraphs(lines)[0] ?? "";
}

function collectDistinctCompetitiveReferences(records: VerificationRecord[]): CompetitiveReference[] {
  const distinct = new Map<string, CompetitiveReference>();

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

async function writeCompetitiveArtifact(
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
  return normalized || "competitive-research";
}

function hasCompetitiveBundleArtifacts(artifacts: string[]): boolean {
  const lowerArtifacts = artifacts.map((artifact) => artifact.toLowerCase());
  return lowerArtifacts.some((artifact) => artifact.endsWith("-report.md"))
    && lowerArtifacts.some((artifact) => artifact.endsWith("-summary.md"))
    && lowerArtifacts.some((artifact) => artifact.endsWith("-comparison.json"))
    && lowerArtifacts.some((artifact) => artifact.endsWith("-references.json"));
}
