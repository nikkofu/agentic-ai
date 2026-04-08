import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { archiveDeliveryArtifacts, verifyArtifactFiles } from "../../src/core/deliveryArtifacts";

const createdPaths: string[] = [];

afterEach(() => {
  for (const target of createdPaths.splice(0)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

describe("deliveryArtifacts", () => {
  it("archives final result into artifacts directory and returns relative artifact path", async () => {
    const taskId = "task-artifact-test";
    const artifactsDir = path.resolve("artifacts");
    const logsDir = path.resolve("logs");
    createdPaths.push(artifactsDir, logsDir);

    const archived = await archiveDeliveryArtifacts({
      taskId,
      taskInput: "Write a final article about openclaw",
      delivery: {
        status: "completed",
        final_result: "final article body",
        artifacts: [],
        verification: ["https://example.com"],
        risks: [],
        next_actions: []
      }
    });

    expect(archived.artifacts).toEqual(["artifacts/write-a-final-article-about-openclaw.md"]);
    expect(fs.existsSync(path.resolve(archived.artifacts[0]))).toBe(true);
    expect(fs.readFileSync(path.resolve(archived.artifacts[0]), "utf8")).toContain("final article body");
    expect(fs.existsSync(path.resolve("logs/runs/task-artifact-test/delivery.json"))).toBe(true);
  });

  it("rejects missing or empty artifact files", async () => {
    const taskId = "task-artifact-verify";
    const baseDir = path.resolve("artifacts", taskId);
    createdPaths.push(baseDir);
    fs.mkdirSync(baseDir, { recursive: true });

    const emptyFile = path.join(baseDir, "empty.md");
    fs.writeFileSync(emptyFile, "");

    const result = await verifyArtifactFiles([`artifacts/${taskId}/empty.md`, `artifacts/${taskId}/missing.md`]);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("artifact_missing_or_empty");
    expect(result.invalidArtifacts).toEqual([
      `artifacts/${taskId}/empty.md`,
      `artifacts/${taskId}/missing.md`
    ]);
  });
});
