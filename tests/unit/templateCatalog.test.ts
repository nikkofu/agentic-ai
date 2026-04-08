import { describe, expect, it } from "vitest";

import { getTemplateByName } from "../../src/cli/templateCatalog";

describe("template catalog", () => {
  it("returns built-in research template", () => {
    const tpl = getTemplateByName("research");
    expect(tpl.name).toBe("research");
    expect(tpl.content).toContain("Goal");
  });

  it("returns built-in execution template", () => {
    const tpl = getTemplateByName("execution");
    expect(tpl.name).toBe("execution");
    expect(tpl.content).toContain("Expected Output");
  });

  it("throws for unknown template", () => {
    expect(() => getTemplateByName("unknown")).toThrow(/Unknown template/);
  });
});
