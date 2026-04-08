import { describe, it, expect } from "vitest";
import { generateConfigContent } from "../../src/cli/initWizard";

describe("Init Wizard", () => {
  it("generates correct config for OpenRouter", () => {
    const { envContent, yamlContent } = generateConfigContent({
      provider: "openrouter",
      enableDb: true,
      skills: ["code-reviewer"]
    });

    expect(envContent).toContain("OPENROUTER_API_KEY=");
    expect(yamlContent).toContain("default: \"nvidia/nemotron-3-super-120b-a12b:free\"");
  });

  it("generates correct config for Generic OpenAI", () => {
    const { envContent, yamlContent } = generateConfigContent({
      provider: "generic",
      baseUrl: "http://localhost:1234/v1",
      enableDb: false,
      skills: []
    });

    expect(envContent).toContain("OPENAI_API_KEY=");
    expect(yamlContent).toContain('base_url: "http://localhost:1234/v1"');
    expect(yamlContent).toContain('api_key_env: "OPENAI_API_KEY"');
  });
});
