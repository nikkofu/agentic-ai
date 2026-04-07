import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { runtimeConfigSchema } from "../types/runtime";
export function getRuntimeConfig(configPath = path.resolve(process.cwd(), "config/runtime.yaml")) {
    const baseParsed = parseYamlFile(configPath);
    const localPath = process.env.RUNTIME_CONFIG_LOCAL_PATH ?? path.resolve(process.cwd(), "config/runtime.local.yaml");
    const localParsed = fs.existsSync(localPath) ? parseYamlFile(localPath) : {};
    const merged = deepMerge(baseParsed, localParsed);
    if (process.env.OPENROUTER_DEFAULT_MODEL) {
        const models = (merged.models ?? {});
        models.default = process.env.OPENROUTER_DEFAULT_MODEL;
        merged.models = models;
    }
    return runtimeConfigSchema.parse(merged);
}
function parseYamlFile(filePath) {
    const fileText = fs.readFileSync(filePath, "utf8");
    return YAML.parse(fileText);
}
function deepMerge(base, overlay) {
    const output = { ...base };
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
function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
