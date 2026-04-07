import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { runtimeConfigSchema, type RuntimeConfig } from "../types/runtime";

export function getRuntimeConfig(configPath = path.resolve(process.cwd(), "config/runtime.yaml")): RuntimeConfig {
  const fileText = fs.readFileSync(configPath, "utf8");
  const parsed = YAML.parse(fileText);
  return runtimeConfigSchema.parse(parsed);
}
