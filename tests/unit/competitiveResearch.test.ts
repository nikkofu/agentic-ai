import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildCompetitiveComparisonArtifact,
  buildCompetitiveReferencesArtifact,
  buildCompetitiveSummaryArtifact,
  computeCompetitiveSourceCoverage,
  finalizeCompetitiveResearchDelivery
} from "../../src/runtime/competitiveResearch";
import type { FamilyDeliveryBundle, VerificationRecord } from "../../src/runtime/contracts";

const REPORT = `# Competitive Research

## Subject
Agentic AI

## Comparison Targets
- OpenClaw
- Hermes Agent

## Comparison Dimensions
- product positioning
- delivery trust
- memory model

## Executive Summary
Agentic AI is stronger on verifier-backed delivery and completion evidence. OpenClaw leads on channels and assistant surface breadth.

## Key Findings
- Agentic AI has stronger trusted delivery controls.
- OpenClaw has broader end-user assistant surfaces.
- Hermes Agent has deeper self-improving memory and skill automation.

## Recommendations
- Double down on trusted delivery and completion intelligence.
- Avoid competing on raw channel count alone.
`;

afterEach(() => {
  fs.rmSync(path.resolve("artifacts", "competitive-research-report.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "competitive-research-summary.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "competitive-research-comparison.json"), { force: true });
  fs.rmSync(path.resolve("artifacts", "competitive-research-references.json"), { force: true });
});

describe("competitiveResearch", () => {
  it("builds structured comparison, summary, and references artifacts from a research report", () => {
    const verification: VerificationRecord[] = [
      {
        kind: "source",
        summary: "OpenClaw README",
        sourceId: "openclaw-readme",
        locator: "https://github.com/openclaw/openclaw",
        passed: true
      },
      {
        kind: "source",
        summary: "Hermes Agent README",
        sourceId: "hermes-readme",
        locator: "https://github.com/NousResearch/hermes-agent",
        passed: true
      }
    ];

    expect(computeCompetitiveSourceCoverage(verification)).toBe(2);

    const comparison = JSON.parse(buildCompetitiveComparisonArtifact(REPORT).content);
    const summary = buildCompetitiveSummaryArtifact(REPORT);
    const references = JSON.parse(buildCompetitiveReferencesArtifact(verification).content);

    expect(comparison).toMatchObject({
      subject: "Agentic AI",
      comparisonTargets: ["OpenClaw", "Hermes Agent"],
      comparisonDimensions: ["product positioning", "delivery trust", "memory model"]
    });
    expect(comparison.keyFindings).toHaveLength(3);
    expect(comparison.recommendations).toEqual([
      "Double down on trusted delivery and completion intelligence.",
      "Avoid competing on raw channel count alone."
    ]);
    expect(summary.content).toContain("## Executive Summary");
    expect(summary.content).toContain("## Recommendations");
    expect(summary.preview[0]).toContain("Agentic AI is stronger on verifier-backed delivery");
    expect(references).toEqual([
      {
        sourceId: "openclaw-readme",
        summary: "OpenClaw README",
        locator: "https://github.com/openclaw/openclaw"
      },
      {
        sourceId: "hermes-readme",
        summary: "Hermes Agent README",
        locator: "https://github.com/NousResearch/hermes-agent"
      }
    ]);
  });

  it("archives the competitive research bundle artifacts for the family delivery", async () => {
    const delivery: FamilyDeliveryBundle = {
      family: "competitive_research",
      status: "completed",
      final_result: REPORT,
      artifacts: [],
      verification: [
        {
          kind: "source",
          summary: "OpenClaw README",
          sourceId: "openclaw-readme",
          locator: "https://github.com/openclaw/openclaw",
          passed: true
        },
        {
          kind: "source",
          summary: "Hermes Agent README",
          sourceId: "hermes-readme",
          locator: "https://github.com/NousResearch/hermes-agent",
          passed: true
        }
      ],
      risks: [],
      next_actions: [],
      delivery_proof: {
        family: "competitive_research",
        steps: []
      }
    };

    const finalized = await finalizeCompetitiveResearchDelivery({
      taskId: "competitive-research",
      taskInput: "Compare agent platforms",
      delivery
    });

    expect(finalized.artifacts).toEqual([
      "artifacts/competitive-research-report.md",
      "artifacts/competitive-research-summary.md",
      "artifacts/competitive-research-comparison.json",
      "artifacts/competitive-research-references.json"
    ]);
    expect(fs.existsSync(path.resolve("artifacts", "competitive-research-report.md"))).toBe(true);
    expect(fs.existsSync(path.resolve("artifacts", "competitive-research-summary.md"))).toBe(true);
    expect(fs.existsSync(path.resolve("artifacts", "competitive-research-comparison.json"))).toBe(true);
    expect(fs.existsSync(path.resolve("artifacts", "competitive-research-references.json"))).toBe(true);
  });
});
