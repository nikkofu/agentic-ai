import { describe, expect, it, vi } from "vitest";

import { createBrowserTools } from "../../src/tools/browserTools";

describe("browserTools", () => {
  it("understand_page returns structured page facts", async () => {
    const tools = createBrowserTools();
    const output = await tools.find((tool) => tool.name === "understand_page")!.run({
      url: "https://example.com/signup",
      title: "Sign up",
      actions: ["fill email", "submit"],
      fields: ["email", "name"],
      authenticated: false
    });

    expect(output).toEqual({
      url: "https://example.com/signup",
      title: "Sign up",
      actions: ["fill email", "submit"],
      fields: ["email", "name"],
      authenticated: false
    });
  });

  it("validate_browser_outcome returns a passed validation summary", async () => {
    const tools = createBrowserTools();
    const output = await tools.find((tool) => tool.name === "validate_browser_outcome")!.run({
      summary: "confirmation banner visible",
      passed: true,
      locator: "#confirmation"
    });

    expect(output).toEqual({
      summary: "confirmation banner visible",
      passed: true,
      locator: "#confirmation"
    });
  });
});
