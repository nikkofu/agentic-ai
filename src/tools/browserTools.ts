import type { LocalTool } from "./localToolRegistry";

export function createBrowserTools(): LocalTool[] {
  return [
    {
      name: "understand_page",
      run: async (input) => normalizePageUnderstanding(input)
    },
    {
      name: "validate_browser_outcome",
      run: async (input) => normalizeBrowserValidation(input)
    }
  ];
}

function normalizePageUnderstanding(input: unknown) {
  const value = asRecord(input);
  return {
    url: stringField(value, "url"),
    title: stringField(value, "title"),
    actions: stringArrayField(value, "actions"),
    fields: stringArrayField(value, "fields"),
    authenticated: booleanField(value, "authenticated")
  };
}

function normalizeBrowserValidation(input: unknown) {
  const value = asRecord(input);
  return {
    summary: stringField(value, "summary"),
    passed: booleanField(value, "passed"),
    locator: optionalStringField(value, "locator")
  };
}

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") {
    throw new Error("browser tool input must be an object");
  }
  return input as Record<string, unknown>;
}

function stringField(value: Record<string, unknown>, key: string): string {
  if (typeof value[key] !== "string") {
    throw new Error(`${key} must be a string`);
  }
  return value[key] as string;
}

function optionalStringField(value: Record<string, unknown>, key: string): string | undefined {
  return typeof value[key] === "string" ? (value[key] as string) : undefined;
}

function stringArrayField(value: Record<string, unknown>, key: string): string[] {
  if (!Array.isArray(value[key])) {
    throw new Error(`${key} must be a string array`);
  }
  return (value[key] as unknown[]).filter((entry): entry is string => typeof entry === "string");
}

function booleanField(value: Record<string, unknown>, key: string): boolean {
  if (typeof value[key] !== "boolean") {
    throw new Error(`${key} must be a boolean`);
  }
  return value[key] as boolean;
}
