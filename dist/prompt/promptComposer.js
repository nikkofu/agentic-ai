export function composePromptPayload(input) {
    return {
        system: input.system,
        role: input.role,
        task: input.task,
        context: input.context,
        tools: input.tools,
        memory: input.memory,
        constraints: input.constraints,
        output_schema: input.outputSchema
    };
}
