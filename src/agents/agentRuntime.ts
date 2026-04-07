import { generateWithOpenRouter, type OpenRouterGenerateRequest, type OpenRouterGenerateResponse } from "../model/openrouterClient";
import { RequestLimiter } from "../core/limiter";

type SimulatedRunArgs = {
  forceGuardrailTrip?: boolean;
};

type RetryPolicy = {
  max_retries: number;
  base_delay_ms: number;
};

type OpenRouterRunArgs = {
  apiKey?: string;
  model: string;
  fallbackModels?: string[];
  reasoner: string;
  input: unknown;
  retry?: RetryPolicy;
};

type AgentRuntimeMode = "simulated" | "openrouter";

type AgentRuntimeDeps = {
  limiter?: RequestLimiter;
  mode?: AgentRuntimeMode;
  generate?: (request: OpenRouterGenerateRequest) => Promise<OpenRouterGenerateResponse>;
  sleep?: (ms: number) => Promise<void>;
};

export function createAgentRuntime(deps: AgentRuntimeDeps = {}) {
  const mode = deps.mode ?? "simulated";
  const generate = deps.generate ?? generateWithOpenRouter;
  const limiter = deps.limiter;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  return {
    async run(args?: SimulatedRunArgs | OpenRouterRunArgs) {
      if (mode === "openrouter") {
        const openrouterArgs = args as OpenRouterRunArgs | undefined;

        if (!openrouterArgs?.apiKey) {
          throw new Error("OPENROUTER_API_KEY is required");
        }

        const retry = openrouterArgs.retry ?? { max_retries: 0, base_delay_ms: 100 };
        const models = [openrouterArgs.model, ...(openrouterArgs.fallbackModels ?? [])];

        let lastError: unknown;

        for (const model of models) {
          for (let attempt = 0; attempt <= retry.max_retries; attempt += 1) {
            try {
              if (limiter) await limiter.acquire(); 
              const response = await generate({
                apiKey: openrouterArgs.apiKey,
                model,
                reasoner: openrouterArgs.reasoner,
                input: openrouterArgs.input
              });

              return {
                usedTool: true,
                evaluation: "pass",
                outputText: response.outputText,
                raw: response.raw
              } as const;
            } catch (error) {
              lastError = error;
              if (!shouldRetry(error)) {
                throw error;
              }

              if (attempt >= retry.max_retries) {
                break;
              }

              const backoff = retry.base_delay_ms * 2 ** attempt;
              await sleep(backoff);
            }
          }
        }

        throw lastError;
      }

      return {
        usedTool: true,
        evaluation: "pass"
      } as const;
    }
  };
}

function shouldRetry(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const text = error.message;
  if (/timeout/i.test(text)) {
    return true;
  }

  const match = text.match(/openrouter_error:(\d{3})/);
  if (!match) {
    return false;
  }

  const status = Number(match[1]);
  if (status === 429) {
    return true;
  }

  if (status >= 500 && status <= 599) {
    return true;
  }

  return false;
}
