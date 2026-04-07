export type OpenRouterGenerateRequest = {
  apiKey: string;
  model: string;
  reasoner: string;
  input: unknown;
  baseUrl?: string;
};

export type OpenRouterGenerateResponse = {
  outputText: string;
  raw: unknown;
};

export async function generateWithOpenRouter(request: OpenRouterGenerateRequest): Promise<OpenRouterGenerateResponse> {
  const response = await fetch(request.baseUrl ?? "https://openrouter.ai/api/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${request.apiKey}`
    },
    body: JSON.stringify({
      model: request.model,
      input: request.input,
      reasoner: request.reasoner
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`openrouter_error:${response.status}:${text}`);
  }

  const raw = await response.json();
  const outputText = typeof raw?.output_text === "string" ? raw.output_text : "";

  return {
    outputText,
    raw
  };
}
