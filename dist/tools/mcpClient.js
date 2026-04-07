export class McpError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = "McpError";
    }
}
export function createMcpClient(invoke) {
    return { invoke };
}
