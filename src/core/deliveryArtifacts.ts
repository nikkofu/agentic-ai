import fs from "node:fs/promises";
import path from "node:path";

import type { DeliveryBundle } from "../types/runtime";

type ArchiveDeliveryArgs = {
  taskId: string;
  taskInput?: string;
  delivery: DeliveryBundle;
  artifactsRoot?: string;
  runtimeLogsRoot?: string;
};

type VerifyArtifactResult = {
  ok: boolean;
  reason?: "artifact_missing_or_empty";
  invalidArtifacts: string[];
};

type FinalizeDeliveryArgs = {
  taskId: string;
  taskInput: string;
  delivery: DeliveryBundle;
  artifactsRoot?: string;
  runtimeLogsRoot?: string;
};

export async function archiveDeliveryArtifacts(args: ArchiveDeliveryArgs): Promise<DeliveryBundle> {
  const artifactsRoot = path.resolve(args.artifactsRoot ?? "artifacts");
  const runtimeLogsRoot = path.resolve(args.runtimeLogsRoot ?? path.join("logs", "runs"));
  const taskLogDir = path.join(runtimeLogsRoot, args.taskId);
  await fs.mkdir(taskLogDir, { recursive: true });

  const normalizedArtifacts: string[] = [];

  if (args.delivery.status === "completed" && args.delivery.final_result.trim().length > 0) {
    await fs.mkdir(artifactsRoot, { recursive: true });
    const finalPath = path.join(artifactsRoot, `${buildArtifactBaseName(args.taskInput, args.taskId)}.md`);
    await fs.writeFile(finalPath, args.delivery.final_result, "utf8");
    normalizedArtifacts.push(toRelativeArtifactPath(finalPath));
  }

  for (const artifactPath of args.delivery.artifacts) {
    const absoluteSource = path.resolve(artifactPath);
    if (artifactPath.startsWith("artifacts/")) {
      normalizedArtifacts.push(artifactPath);
      continue;
    }

    try {
      const stats = await fs.stat(absoluteSource);
      if (!stats.isFile() || stats.size === 0) {
        continue;
      }

      await fs.mkdir(artifactsRoot, { recursive: true });
      const copiedPath = path.join(artifactsRoot, path.basename(artifactPath));
      await fs.copyFile(absoluteSource, copiedPath);
      normalizedArtifacts.push(toRelativeArtifactPath(copiedPath));
    } catch {
      continue;
    }
  }

  const deliveryRecordPath = path.join(taskLogDir, "delivery.json");
  await fs.writeFile(
    deliveryRecordPath,
    JSON.stringify(
      {
        ...args.delivery,
        artifacts: dedupeArtifacts(normalizedArtifacts)
      },
      null,
      2
    ),
    "utf8"
  );

  return {
    ...args.delivery,
    artifacts: dedupeArtifacts(normalizedArtifacts)
  };
}

export async function archiveSupplementalArtifact(args: {
  taskId: string;
  taskInput?: string;
  suffix: string;
  content: string;
  artifactsRoot?: string;
}): Promise<string> {
  const artifactsRoot = path.resolve(args.artifactsRoot ?? "artifacts");
  await fs.mkdir(artifactsRoot, { recursive: true });

  const artifactPath = path.join(
    artifactsRoot,
    `${buildArtifactBaseName(args.taskInput, args.taskId)}-${args.suffix}`
  );
  await fs.writeFile(artifactPath, args.content, "utf8");
  return toRelativeArtifactPath(artifactPath);
}

export async function verifyArtifactFiles(artifacts: string[]): Promise<VerifyArtifactResult> {
  const invalidArtifacts: string[] = [];

  for (const artifact of artifacts) {
    if (!artifact.startsWith("artifacts/")) {
      invalidArtifacts.push(artifact);
      continue;
    }

    try {
      const stats = await fs.stat(path.resolve(artifact));
      if (!stats.isFile() || stats.size === 0) {
        invalidArtifacts.push(artifact);
      }
    } catch {
      invalidArtifacts.push(artifact);
    }
  }

  if (invalidArtifacts.length > 0) {
    return {
      ok: false,
      reason: "artifact_missing_or_empty",
      invalidArtifacts
    };
  }

  return {
    ok: true,
    invalidArtifacts: []
  };
}

export async function finalizeDelivery(args: FinalizeDeliveryArgs): Promise<DeliveryBundle> {
  const emptyDelivery = args.delivery.final_result.trim().length === 0 && args.delivery.artifacts.length === 0;

  if (emptyDelivery) {
    const blockedDelivery = {
      ...args.delivery,
      status: "blocked" as const,
      blocking_reason: "empty_delivery"
    };
    await archiveDeliveryArtifacts({ ...args, delivery: blockedDelivery });
    return {
      ...blockedDelivery,
      artifacts: []
    };
  }

  if (requiresVerification(args.taskInput) && args.delivery.verification.length === 0) {
    const blockedDelivery = {
      ...args.delivery,
      status: "blocked" as const,
      blocking_reason: "verification_missing"
    };
    await archiveDeliveryArtifacts({ ...args, delivery: blockedDelivery });
    return {
      ...blockedDelivery,
      artifacts: []
    };
  }

  const archived = await archiveDeliveryArtifacts({
    ...args,
    delivery: {
      ...args.delivery,
      status: "completed"
    }
  });
  const artifactCheck = await verifyArtifactFiles(archived.artifacts);

  if (!artifactCheck.ok) {
    const blockedDelivery = {
      ...archived,
      status: "blocked" as const,
      blocking_reason: artifactCheck.reason,
      risks: dedupeStrings([...archived.risks, ...artifactCheck.invalidArtifacts]),
      artifacts: []
    };
    await archiveDeliveryArtifacts({ ...args, delivery: blockedDelivery });
    return {
      ...blockedDelivery
    };
  }

  return archived;
}

function requiresVerification(taskInput: string): boolean {
  return /(调研|research|github|开源|repo|repository|资料|综述|分析)/i.test(taskInput);
}

function toRelativeArtifactPath(absolutePath: string): string {
  const relativePath = path.relative(process.cwd(), absolutePath).replace(/\\/g, "/");
  return relativePath.startsWith("artifacts/") ? relativePath : `artifacts/${path.basename(absolutePath)}`;
}

function buildArtifactBaseName(taskInput: string | undefined, taskId: string): string {
  const slug = (taskInput ?? "")
    .toLowerCase()
    .replace(/[\u4e00-\u9fa5]+/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug.length > 0 ? slug : `delivery-${taskId.slice(0, 8)}`;
}

function dedupeArtifacts(artifacts: string[]): string[] {
  return Array.from(new Set(artifacts));
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}
