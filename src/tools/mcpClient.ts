export type McpErrorMode = "timeout" | "auth" | "protocol";

export class McpError extends Error {
  constructor(public readonly code: McpErrorMode, message: string) {
    super(message);
    this.name = "McpError";
  }
}

export type McpClient = {
  invoke: (tool: string, input: unknown) => Promise<unknown>;
};

export function createMcpClient(invoke: (tool: string, input: unknown) => Promise<unknown>): McpClient {
  return { invoke };
}
