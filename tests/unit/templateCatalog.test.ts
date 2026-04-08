import { describe, it, expect } from "vitest";
import { loadTemplate } from "../../src/cli/templateCatalog";

describe("template catalog", () => {
  it("returns built-in research template", () => {
    const tpl = loadTemplate("research");
    expect(tpl.name).toBe("research");
    expect(tpl.body).toContain("Goal");
  });

  it("returns built-in execution template", () => {
    const tpl = loadTemplate("execution");
    expect(tpl.name).toBe("execution");
    expect(tpl.body).toContain("Expected Output");
  });

  it("throws for unknown template", () => {
    expect(() => loadTemplate("unknown")).toThrow(/Unknown template/);
  });
});
