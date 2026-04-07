export function resolveModelRoute(config, role, env = process.env) {
    const modelOverride = env.OPENROUTER_DEFAULT_MODEL;
    const model = modelOverride ?? config.models.byAgentRole[role] ?? config.models.default;
    const reasoner = config.reasoner.byAgentRole[role] ?? config.reasoner.default;
    return {
        model,
        reasoner
    };
}
