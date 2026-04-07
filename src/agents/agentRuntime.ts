import { generateWithOpenRouter, type OpenRouterGenerateRequest, type OpenRouterGenerateResponse } from "../model/openrouterClient";

type SimulatedRunArgs = {
  forceGuardrailTrip?: boolean;
};

type OpenRouterRunArgs = {
  apiKey?: string;
  model: string;
  reasoner: string;
  input: unknown;
};

type AgentRuntimeMode = "simulated" | "openrouter";

type AgentRuntimeDeps = {
  mode?: AgentRuntimeMode;
  generate?: (request: OpenRouterGenerateRequest) => Promise<OpenRouterGenerateResponse>;
};

export function createAgentRuntime(deps: AgentRuntimeDeps = {}) {
  const mode = deps.mode ?? "simulated";
  const generate = deps.generate ?? generateWithOpenRouter;

  return {
    async run(args?: SimulatedRunArgs | OpenRouterRunArgs) {
      if (mode === "openrouter") {
        const openrouterArgs = args as OpenRouterRunArgs | undefined;

        if (!openrouterArgs?.apiKey) {
          throw new Error("OPENROUTER_API_KEY is required");
        }

        const response = await generate({
          apiKey: openrouterArgs.apiKey,
          model: openrouterArgs.model,
          reasoner: openrouterArgs.reasoner,
          input: openrouterArgs.input
        });

        return {
          usedTool: true,
          evaluation: "pass",
          outputText: response.outputText,
          raw: response.raw
        } as const;
      }

      return {
        usedTool: true,
        evaluation: "pass"
      } as const;
    }
  };
}
