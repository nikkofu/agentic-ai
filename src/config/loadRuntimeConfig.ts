import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { runtimeConfigSchema, type RuntimeConfig } from "../types/runtime";

export function getRuntimeConfig(configPath = path.resolve(process.cwd(), "config/runtime.yaml")): RuntimeConfig {
  const baseParsed = parseYamlFile(configPath);

  const localPath = process.env.RUNTIME_CONFIG_LOCAL_PATH ?? path.resolve(process.cwd(), "config/runtime.local.yaml");
  const localParsed = fs.existsSync(localPath) ? parseYamlFile(localPath) : {};

  const merged = deepMerge(baseParsed, localParsed);

  if (process.env.OPENROUTER_DEFAULT_MODEL) {
    merged.models = merged.models ?? {};
    merged.models.default = process.env.OPENROUTER_DEFAULT_MODEL;
  }

  return runtimeConfigSchema.parse(merged);
}

function parseYamlFile(filePath: string): Record<string, unknown> {
  const fileText = fs.readFileSync(filePath, "utf8");
  return YAML.parse(fileText) as Record<string, unknown>;
}

function deepMerge(base: Record<string, unknown>, overlay: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = { ...base };

  for (const [key, overlayValue] of Object.entries(overlay)) {
    const baseValue = output[key];

    if (isPlainObject(baseValue) && isPlainObject(overlayValue)) {
      output[key] = deepMerge(baseValue, overlayValue);
      continue;
    }

    output[key] = overlayValue;
  }

  return output;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
