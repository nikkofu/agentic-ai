import { generateWithOpenRouter } from "../model/openrouterClient";
export function createAgentRuntime(deps = {}) {
    const mode = deps.mode ?? "simulated";
    const generate = deps.generate ?? generateWithOpenRouter;
    const sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    return {
        async run(args) {
            if (mode === "openrouter") {
                const openrouterArgs = args;
                if (!openrouterArgs?.apiKey) {
                    throw new Error("OPENROUTER_API_KEY is required");
                }
                const retry = openrouterArgs.retry ?? { maxRetries: 0, baseDelayMs: 100 };
                const models = [openrouterArgs.model, ...(openrouterArgs.fallbackModels ?? [])];
                let lastError;
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
                            };
                        }
                        catch (error) {
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
            };
        }
    };
}
function shouldRetry(error) {
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
