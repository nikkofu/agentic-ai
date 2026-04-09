import { describe, expect, it, vi } from "vitest";

import { createResearchTools } from "../../src/tools/researchTools";

describe("researchTools", () => {
  it("web_search normalizes search results with verification fields", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        web: {
          results: [
            {
              title: "OpenClaw",
              url: "https://github.com/example/openclaw",
              description: "A distributed crawler"
            }
          ]
        }
      })
    }));

    const tools = createResearchTools({ fetchImpl });
    const output = await tools.find((tool) => tool.name === "web_search")!.run({ query: "openclaw github" });

    expect(output).toEqual({
      query: "openclaw github",
      results: [
        {
          source_id: "https://github.com/example/openclaw",
          title: "OpenClaw",
          url: "https://github.com/example/openclaw",
          snippet: "A distributed crawler"
        }
      ]
    });
  });

  it("github_readme extracts repository readme markdown", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      text: async () => "# OpenClaw\n\nREADME body"
    }));

    const tools = createResearchTools({ fetchImpl });
    const output = await tools.find((tool) => tool.name === "github_readme")!.run({
      owner: "example",
      repo: "openclaw"
    });

    expect(output).toEqual({
      repo: "example/openclaw",
      url: "https://raw.githubusercontent.com/example/openclaw/HEAD/README.md",
      source_id: "github:example/openclaw:README",
      content: "# OpenClaw\n\nREADME body"
    });
  });
});
