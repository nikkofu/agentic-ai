import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildChannelVariantsArtifact,
  buildOutlineArtifact,
  buildPrimaryDraftArtifact,
  buildProductionPlanArtifact,
  finalizeContentPipelineDelivery,
  summarizeContentPackage
} from "../../src/runtime/contentPipeline";
import type { FamilyDeliveryBundle } from "../../src/runtime/contracts";

const CONTENT_REPORT = `# Content Package

## Objective
Explain why agentic runtime families matter.

## Audience
Technical product builders evaluating agent systems.

## Key Message
Family-native runtimes produce more trustworthy delivery than generic agent loops.

## Outline
- Why generic agents drift
- Why task families matter
- Why verifier-backed delivery changes outcomes

## Primary Draft
# Why Family-Native Runtimes Matter

Generic agent loops are flexible, but they often blur the line between attempted work and accepted delivery. A family-native runtime gives each workflow an explicit delivery contract and verifier boundary.

## Channel Variants
- channel: linkedin
  format: short_post
  summary: Family-native runtimes make agent delivery more trustworthy.
  content: Family-native runtimes turn vague agent work into structured delivery contracts.
  source_anchor: primary-draft
- channel: newsletter
  format: teaser
  summary: Trusted delivery beats generic agent loops.
  content: Verifier-backed delivery helps teams know what is actually done.
  source_anchor: primary-draft

## Production Plan
- next_step: review with operator
- next_step: publish primary draft
- distribution_target: linkedin
- distribution_target: newsletter
- handoff_check: verify bundle completeness
`;

afterEach(() => {
  fs.rmSync(path.resolve("artifacts", "content-package-outline.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "content-package-primary-draft.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "content-package-channel-variants.json"), { force: true });
  fs.rmSync(path.resolve("artifacts", "content-package-production-plan.json"), { force: true });
});

describe("contentPipeline", () => {
  it("builds content package artifacts and summaries from a structured report", () => {
    const outline = buildOutlineArtifact(CONTENT_REPORT);
    const primaryDraft = buildPrimaryDraftArtifact(CONTENT_REPORT);
    const channelVariants = JSON.parse(buildChannelVariantsArtifact(CONTENT_REPORT).content);
    const productionPlan = JSON.parse(buildProductionPlanArtifact(CONTENT_REPORT).content);
    const summary = summarizeContentPackage({
      report: CONTENT_REPORT,
      artifacts: [
        "artifacts/content-package-outline.md",
        "artifacts/content-package-primary-draft.md",
        "artifacts/content-package-channel-variants.json",
        "artifacts/content-package-production-plan.json"
      ]
    });

    expect(outline.content).toContain("## Objective");
    expect(outline.content).toContain("## Audience");
    expect(outline.content).toContain("## Key Message");
    expect(primaryDraft.content).toContain("# Why Family-Native Runtimes Matter");
    expect(channelVariants).toEqual([
      {
        channel: "linkedin",
        format: "short_post",
        summary: "Family-native runtimes make agent delivery more trustworthy.",
        content: "Family-native runtimes turn vague agent work into structured delivery contracts.",
        source_anchor: "primary-draft"
      },
      {
        channel: "newsletter",
        format: "teaser",
        summary: "Trusted delivery beats generic agent loops.",
        content: "Verifier-backed delivery helps teams know what is actually done.",
        source_anchor: "primary-draft"
      }
    ]);
    expect(productionPlan).toMatchObject({
      objective: "Explain why agentic runtime families matter.",
      audience: "Technical product builders evaluating agent systems.",
      key_messages: ["Family-native runtimes produce more trustworthy delivery than generic agent loops."],
      next_steps: ["review with operator", "publish primary draft"],
      distribution_targets: ["linkedin", "newsletter"],
      handoff_checks: ["verify bundle completeness"]
    });
    expect(summary).toMatchObject({
      objective: "Explain why agentic runtime families matter.",
      audience: "Technical product builders evaluating agent systems.",
      keyMessage: "Family-native runtimes produce more trustworthy delivery than generic agent loops.",
      variantCount: 2,
      productionStepCount: 2,
      bundleComplete: true
    });
  });

  it("archives the content pipeline bundle artifacts for the family delivery", async () => {
    const delivery: FamilyDeliveryBundle = {
      family: "content_pipeline",
      status: "completed",
      final_result: CONTENT_REPORT,
      artifacts: [],
      verification: [],
      risks: [],
      next_actions: [],
      delivery_proof: {
        family: "content_pipeline",
        steps: []
      }
    };

    const finalized = await finalizeContentPipelineDelivery({
      taskId: "content-package",
      taskInput: "Build a content package",
      delivery
    });

    expect(finalized.artifacts).toEqual([
      "artifacts/content-package-outline.md",
      "artifacts/content-package-primary-draft.md",
      "artifacts/content-package-channel-variants.json",
      "artifacts/content-package-production-plan.json"
    ]);
    expect(fs.existsSync(path.resolve("artifacts", "content-package-outline.md"))).toBe(true);
    expect(fs.existsSync(path.resolve("artifacts", "content-package-primary-draft.md"))).toBe(true);
    expect(fs.existsSync(path.resolve("artifacts", "content-package-channel-variants.json"))).toBe(true);
    expect(fs.existsSync(path.resolve("artifacts", "content-package-production-plan.json"))).toBe(true);
  });
});
