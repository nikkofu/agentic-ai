import { describe, expect, it } from "vitest";

import { buildResearchReferencesArtifact, computeResearchSourceCoverage } from "../../src/runtime/researchWriting";

describe("researchWriting", () => {
  it("builds a references artifact from distinct verified sources", () => {
    const artifact = buildResearchReferencesArtifact([
      {
        kind: "source",
        sourceId: "source-a",
        summary: "OpenClaw README",
        locator: "https://example.com/a",
        passed: true
      },
      {
        kind: "source",
        sourceId: "source-b",
        summary: "OpenClaw architecture notes",
        locator: "https://example.com/b",
        passed: true
      },
      {
        kind: "source",
        sourceId: "source-a",
        summary: "duplicate source",
        locator: "https://example.com/a-2",
        passed: true
      }
    ]);

    expect(artifact.preview).toEqual(["OpenClaw README", "OpenClaw architecture notes"]);
    expect(JSON.parse(artifact.content)).toEqual([
      {
        sourceId: "source-a",
        summary: "OpenClaw README",
        locator: "https://example.com/a"
      },
      {
        sourceId: "source-b",
        summary: "OpenClaw architecture notes",
        locator: "https://example.com/b"
      }
    ]);
  });

  it("computes source coverage from distinct passing source records", () => {
    expect(
      computeResearchSourceCoverage([
        {
          kind: "source",
          sourceId: "source-a",
          summary: "A",
          passed: true
        },
        {
          kind: "source",
          sourceId: "source-a",
          summary: "A duplicate",
          passed: true
        },
        {
          kind: "source",
          sourceId: "source-b",
          summary: "B",
          passed: true
        },
        {
          kind: "artifact_check",
          summary: "artifact exists",
          passed: true
        }
      ])
    ).toBe(2);
  });
});
