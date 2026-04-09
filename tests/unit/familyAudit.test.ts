import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { auditFamilyDelivery } from "../../src/runtime/familyAudit";

afterEach(() => {
  fs.rmSync(path.resolve("artifacts", "phase15-article.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "phase15-references.json"), { force: true });
  fs.rmSync(path.resolve("artifacts", "phase15-run-summary.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "phase15-steps.json"), { force: true });
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
});
