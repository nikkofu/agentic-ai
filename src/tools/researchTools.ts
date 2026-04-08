import type { LocalTool } from "./localToolRegistry";

type FetchLike = typeof fetch;

type CreateResearchToolsArgs = {
  fetchImpl?: FetchLike;
};

export function createResearchTools(args: CreateResearchToolsArgs = {}): LocalTool[] {
  const fetchImpl = args.fetchImpl ?? fetch;

  return [
    {
      name: "web_search",
      run: async (input) => runWebSearch(fetchImpl, input)
    },
    {
      name: "page_fetch",
      run: async (input) => runPageFetch(fetchImpl, input)
    },
    {
      name: "github_readme",
      run: async (input) => runGithubReadme(fetchImpl, input)
    },
    {
      name: "github_file",
      run: async (input) => runGithubFile(fetchImpl, input)
    },
    {
      name: "verify_sources",
      run: async (input) => runVerifySources(fetchImpl, input)
    }
  ];
}

async function runWebSearch(fetchImpl: FetchLike, input: unknown) {
  const { query } = parseObject(input, ["query"]);
  const response = await fetchImpl(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(String(query))}&format=json&no_html=1&skip_disambig=1`
  );
  ensureOk(response, "web_search");

  const payload = await response.json() as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string } | { Topics?: Array<{ Text?: string; FirstURL?: string }> }>;
  };

  if (payload.web?.results?.length) {
    return {
      query,
      results: payload.web.results.map((result) => ({
        title: result.title ?? result.url ?? "untitled",
        url: result.url ?? "",
        snippet: result.description ?? ""
      }))
    };
  }

  const related = flattenDuckDuckGoTopics(payload.RelatedTopics ?? []).slice(0, 5);
  return {
    query,
    results: related.map((item) => ({
      title: item.Text ?? item.FirstURL ?? "untitled",
      url: item.FirstURL ?? "",
      snippet: item.Text ?? ""
    }))
  };
}

async function runPageFetch(fetchImpl: FetchLike, input: unknown) {
  const { url } = parseObject(input, ["url"]);
  const response = await fetchImpl(String(url), {
    headers: {
      "user-agent": "agentic-ai/1.0"
    }
  });
  ensureOk(response, "page_fetch");

  const contentType = response.headers.get("content-type") ?? "text/plain";
  const rawContent = await response.text();

  return {
    url,
    content_type: contentType,
    content: contentType.includes("html") ? stripHtml(rawContent) : rawContent.trim()
  };
}

async function runGithubReadme(fetchImpl: FetchLike, input: unknown) {
  const { owner, repo } = parseObject(input, ["owner", "repo"]);
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`;
  const response = await fetchImpl(url);
  ensureOk(response, "github_readme");

  return {
    repo: `${owner}/${repo}`,
    url,
    content: await response.text()
  };
}

async function runGithubFile(fetchImpl: FetchLike, input: unknown) {
  const { owner, repo, file_path } = parseObject(input, ["owner", "repo", "file_path"]);
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${String(file_path).replace(/^\//, "")}`;
  const response = await fetchImpl(url);
  ensureOk(response, "github_file");

  return {
    repo: `${owner}/${repo}`,
    path: file_path,
    url,
    content: await response.text()
  };
}

async function runVerifySources(fetchImpl: FetchLike, input: unknown) {
  const { urls } = parseObject(input, ["urls"]);
  if (!Array.isArray(urls)) {
    throw new Error("verify_sources requires urls array");
  }

  const results = [];
  for (const url of urls) {
    const response = await fetchImpl(String(url), {
      headers: {
        "user-agent": "agentic-ai/1.0"
      }
    });

    const body = response.ok ? await response.text() : "";
    results.push({
      url: String(url),
      ok: response.ok,
      status: "status" in response ? response.status : 0,
      non_empty: body.trim().length > 0
    });
  }

  return {
    results
  };
}

function parseObject(input: unknown, requiredKeys: string[]): Record<string, unknown> {
  if (!input || typeof input !== "object") {
    throw new Error(`tool input must be an object with keys: ${requiredKeys.join(", ")}`);
  }

  const value = input as Record<string, unknown>;
  for (const key of requiredKeys) {
    if (!(key in value)) {
      throw new Error(`tool input is missing key: ${key}`);
    }
  }
  return value;
}

function ensureOk(response: Response, toolName: string) {
  if (!response.ok) {
    throw new Error(`${toolName} failed with status ${response.status}`);
  }
}

function flattenDuckDuckGoTopics(
  topics: Array<{ Text?: string; FirstURL?: string } | { Topics?: Array<{ Text?: string; FirstURL?: string }> }>
) {
  const flattened: Array<{ Text?: string; FirstURL?: string }> = [];
  for (const topic of topics) {
    if ("Topics" in topic && Array.isArray(topic.Topics)) {
      flattened.push(...topic.Topics);
    } else {
      flattened.push(topic);
    }
  }
  return flattened;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
