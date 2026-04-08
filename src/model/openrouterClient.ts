export type LLMUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type OpenRouterGenerateRequest = {
  apiKey: string;
  model: string;
  reasoner: string;
  input: unknown;
  baseUrl?: string;
};

export type OpenRouterGenerateResponse = {
  outputText: string;
  usage: LLMUsage;
  raw: unknown;
};

export async function generateWithOpenRouter(request: OpenRouterGenerateRequest): Promise<OpenRouterGenerateResponse> {
  const response = await fetch(request.baseUrl ?? "https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${request.apiKey}`
    },
    body: JSON.stringify({
      model: request.model,
      messages: request.input, // Standard OpenAI format uses 'messages'
      reasoner: request.reasoner
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`openrouter_error:${response.status}:${text}`);
  }

  const raw = await response.json();
  
  // Handle standard OpenAI / OpenRouter response format
  const outputText = raw?.choices?.[0]?.message?.content ?? "";
  
  const usage: LLMUsage = {
    prompt_tokens: raw?.usage?.prompt_tokens ?? 0,
    completion_tokens: raw?.usage?.completion_tokens ?? 0,
    total_tokens: raw?.usage?.total_tokens ?? 0
  };

  return {
    outputText,
    usage,
    raw
  };
}
