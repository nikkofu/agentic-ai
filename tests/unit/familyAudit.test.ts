import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { auditFamilyDelivery } from "../../src/runtime/familyAudit";

afterEach(() => {
  fs.rmSync(path.resolve("artifacts", "phase15-article.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "phase15-references.json"), { force: true });
  fs.rmSync(path.resolve("artifacts", "phase15-run-summary.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "phase15-steps.json"), { force: true });
  fs.rmSync(path.resolve("artifacts", "phase21a-report.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "phase21a-summary.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "phase21a-comparison.json"), { force: true });
  fs.rmSync(path.resolve("artifacts", "phase21a-references.json"), { force: true });
  fs.rmSync(path.resolve("artifacts", "phase21b-outline.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "phase21b-primary-draft.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "phase21b-channel-variants.json"), { force: true });
  fs.rmSync(path.resolve("artifacts", "phase21b-production-plan.json"), { force: true });
});

describe("family audit", () => {
  it("accepts a verified research delivery with valid artifacts", async () => {
    fs.mkdirSync(path.resolve("artifacts"), { recursive: true });
    fs.writeFileSync(path.resolve("artifacts", "phase15-article.md"), "article", "utf8");
    fs.writeFileSync(path.resolve("artifacts", "phase15-references.json"), "[]", "utf8");

    const audited = await auditFamilyDelivery({
      delivery: {
        family: "research_writing",
        status: "completed",
        final_result: "article",
        artifacts: ["artifacts/phase15-article.md", "artifacts/phase15-references.json"],
        verification: [
          { kind: "source", summary: "README", sourceId: "a", passed: true },
          { kind: "source", summary: "Docs", sourceId: "b", passed: true }
        ],
        risks: [],
        next_actions: [],
        delivery_proof: { family: "research_writing", steps: [] }
      },
      familyPolicy: {
        family: "research_writing",
        automationPriority: "low",
        trustPriority: "high",
        requireVerification: true,
        requireArtifacts: true,
        sourceCoverageMinimum: 2
      }
    });

    expect(audited.acceptance_proof?.decision).toBe("accept");
  });

  it("accepts a complete competitive research bundle with evidence-backed comparison artifacts", async () => {
    fs.mkdirSync(path.resolve("artifacts"), { recursive: true });
    fs.writeFileSync(path.resolve("artifacts", "phase21a-report.md"), "# report", "utf8");
    fs.writeFileSync(path.resolve("artifacts", "phase21a-summary.md"), "# summary", "utf8");
    fs.writeFileSync(
      path.resolve("artifacts", "phase21a-comparison.json"),
      JSON.stringify({
        subject: "Agentic AI",
        comparisonTargets: ["OpenClaw", "Hermes Agent"],
        comparisonDimensions: ["positioning", "trust"],
        keyFindings: ["finding-a", "finding-b"],
        recommendations: ["recommendation-a"]
      }, null, 2),
      "utf8"
    );
    fs.writeFileSync(path.resolve("artifacts", "phase21a-references.json"), "[]", "utf8");

    const audited = await auditFamilyDelivery({
      delivery: {
        family: "competitive_research",
        status: "completed",
        final_result: "# report",
        artifacts: [
          "artifacts/phase21a-report.md",
          "artifacts/phase21a-summary.md",
          "artifacts/phase21a-comparison.json",
          "artifacts/phase21a-references.json"
        ],
        verification: [
          { kind: "source", summary: "OpenClaw README", sourceId: "a", passed: true },
          { kind: "source", summary: "Hermes README", sourceId: "b", passed: true }
        ],
        risks: [],
        next_actions: [],
        delivery_proof: { family: "competitive_research", steps: [] }
      },
      familyPolicy: {
        family: "competitive_research",
        automationPriority: "medium",
        trustPriority: "high",
        requireVerification: true,
        requireArtifacts: true,
        sourceCoverageMinimum: 2
      }
    });

    expect(audited.acceptance_proof?.decision).toBe("accept");
    expect(audited.acceptance_proof?.verifierSummary).toContain("competitive research");
  });

  it("rejects a competitive research delivery when the bundle is incomplete", async () => {
    fs.mkdirSync(path.resolve("artifacts"), { recursive: true });
    fs.writeFileSync(path.resolve("artifacts", "phase21a-report.md"), "# report", "utf8");

    const audited = await auditFamilyDelivery({
      delivery: {
        family: "competitive_research",
        status: "completed",
        final_result: "# report",
        artifacts: ["artifacts/phase21a-report.md"],
        verification: [
          { kind: "source", summary: "OpenClaw README", sourceId: "a", passed: true }
        ],
        risks: [],
        next_actions: [],
        delivery_proof: { family: "competitive_research", steps: [] }
      },
      familyPolicy: {
        family: "competitive_research",
        automationPriority: "medium",
        trustPriority: "high",
        requireVerification: true,
        requireArtifacts: true,
        sourceCoverageMinimum: 2
      }
    });

    expect(audited.status).toBe("blocked");
    expect(audited.acceptance_proof?.decision).toBe("reject");
    expect(audited.acceptance_proof?.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "bundle_artifact_missing" })
      ])
    );
  });

  it("accepts a complete content pipeline bundle with a valid draft, variants, and production plan", async () => {
    fs.mkdirSync(path.resolve("artifacts"), { recursive: true });
    fs.writeFileSync(path.resolve("artifacts", "phase21b-outline.md"), "# outline", "utf8");
    fs.writeFileSync(path.resolve("artifacts", "phase21b-primary-draft.md"), "# primary draft", "utf8");
    fs.writeFileSync(
      path.resolve("artifacts", "phase21b-channel-variants.json"),
      JSON.stringify([
        {
          channel: "linkedin",
          format: "short_post",
          summary: "summary",
          content: "content",
          source_anchor: "primary-draft"
        }
      ], null, 2),
      "utf8"
    );
    fs.writeFileSync(
      path.resolve("artifacts", "phase21b-production-plan.json"),
      JSON.stringify({
        objective: "Explain why task families matter",
        audience: "operators",
        key_messages: ["Family-native runtimes improve trusted delivery."],
        next_steps: ["review draft"],
        distribution_targets: ["linkedin"],
        handoff_checks: ["verify bundle completeness"]
      }, null, 2),
      "utf8"
    );

    const audited = await auditFamilyDelivery({
      delivery: {
        family: "content_pipeline",
        status: "completed",
        final_result: "# primary draft",
        artifacts: [
          "artifacts/phase21b-outline.md",
          "artifacts/phase21b-primary-draft.md",
          "artifacts/phase21b-channel-variants.json",
          "artifacts/phase21b-production-plan.json"
        ],
        verification: [],
        risks: [],
        next_actions: [],
        delivery_proof: { family: "content_pipeline", steps: [] }
      },
      familyPolicy: {
        family: "content_pipeline",
        automationPriority: "medium",
        trustPriority: "high",
        requireVerification: true,
        requireArtifacts: true
      }
    });

    expect(audited.acceptance_proof?.decision).toBe("accept");
    expect(audited.acceptance_proof?.verifierSummary).toContain("content pipeline");
  });

  it("rejects a content pipeline delivery when the bundle is incomplete", async () => {
    fs.mkdirSync(path.resolve("artifacts"), { recursive: true });
    fs.writeFileSync(path.resolve("artifacts", "phase21b-outline.md"), "# outline", "utf8");
    fs.writeFileSync(path.resolve("artifacts", "phase21b-primary-draft.md"), "# primary draft", "utf8");

    const audited = await auditFamilyDelivery({
      delivery: {
        family: "content_pipeline",
        status: "completed",
        final_result: "# primary draft",
        artifacts: [
          "artifacts/phase21b-outline.md",
          "artifacts/phase21b-primary-draft.md"
        ],
        verification: [],
        risks: [],
        next_actions: [],
        delivery_proof: { family: "content_pipeline", steps: [] }
      },
      familyPolicy: {
        family: "content_pipeline",
        automationPriority: "medium",
        trustPriority: "high",
        requireVerification: true,
        requireArtifacts: true
      }
    });

    expect(audited.status).toBe("blocked");
    expect(audited.acceptance_proof?.decision).toBe("reject");
    expect(audited.acceptance_proof?.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "bundle_artifact_missing" })
      ])
    );
  });
});
