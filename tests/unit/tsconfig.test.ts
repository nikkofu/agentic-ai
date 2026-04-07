import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("typescript config", () => {
  it("uses bundler module resolution for extensionless internal imports", () => {
    const tsconfigPath = path.resolve(process.cwd(), "tsconfig.json");
    const content = JSON.parse(readFileSync(tsconfigPath, "utf8"));

    expect(content.compilerOptions.moduleResolution).toBe("Bundler");
    expect(content.compilerOptions.module).toBe("ESNext");
  });
});
