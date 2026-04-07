import { generateWithOpenRouter, type OpenRouterGenerateRequest, type OpenRouterGenerateResponse } from "../model/openrouterClient";

type SimulatedRunArgs = {
  forceGuardrailTrip?: boolean;
};

type RetryPolicy = {
  maxRetries: number;
  baseDelayMs: number;
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
  mode?: AgentRuntimeMode;
  generate?: (request: OpenRouterGenerateRequest) => Promise<OpenRouterGenerateResponse>;
  sleep?: (ms: number) => Promise<void>;
};

export function createAgentRuntime(deps: AgentRuntimeDeps = {}) {
  const mode = deps.mode ?? "simulated";
  const generate = deps.generate ?? generateWithOpenRouter;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  return {
    async run(args?: SimulatedRunArgs | OpenRouterRunArgs) {
      if (mode === "openrouter") {
        const openrouterArgs = args as OpenRouterRunArgs | undefined;

        if (!openrouterArgs?.apiKey) {
          throw new Error("OPENROUTER_API_KEY is required");
        }

        const retry = openrouterArgs.retry ?? { maxRetries: 0, baseDelayMs: 100 };
        const models = [openrouterArgs.model, ...(openrouterArgs.fallbackModels ?? [])];

        let lastError: unknown;

        for (const model of models) {
          for (let attempt = 0; attempt <= retry.maxRetries; attempt += 1) {
            try {
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

              if (attempt >= retry.maxRetries) {
                break;
              }

              const backoff = retry.baseDelayMs * 2 ** attempt;
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
