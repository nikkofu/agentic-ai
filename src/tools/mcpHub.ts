import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export type McpServerConfig = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

export class McpHub {
  private clients: Map<string, Client> = new Map();
  private transports: StdioClientTransport[] = [];

  constructor(private configs: Record<string, McpServerConfig>) {}

  async initialize() {
    const initPromises = Object.entries(this.configs).map(async ([name, config]) => {
      try {
        // Filter out undefined env vars to satisfy TS
        const filteredProcessEnv: Record<string, string> = {};
        for (const [k, v] of Object.entries(process.env)) {
          if (v !== undefined) {
            filteredProcessEnv[k] = v;
          }
        }

        const transport = new StdioClientTransport({
          command: config.command,
          args: config.args ?? [],
          env: { ...filteredProcessEnv, ...config.env }
        });

        const client = new Client(
          { name: "agentic-runtime-hub", version: "1.0.0" },
          { capabilities: {} }
        );

        // Add 5s timeout for individual server connection
        const connectPromise = client.connect(transport);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Connection timeout for server "${name}"`)), 5000)
        );

        await Promise.race([connectPromise, timeoutPromise]);
        
        this.clients.set(name, client);
        this.transports.push(transport);
        console.log(`✅ MCP server "${name}" initialized`);
      } catch (error) {
        console.error(`❌ Failed to initialize MCP server "${name}":`, error instanceof Error ? error.message : error);
        // Continue with other servers
      }
    });

    await Promise.all(initPromises);
  }

  async callTool(fullToolName: string, args: unknown) {
    const parts = fullToolName.split("/");
    if (parts.length < 2) {
      throw new Error(`Invalid tool name format: ${fullToolName}. Expected "server/tool"`);
    }

    const serverName = parts[0];
    const toolName = parts.slice(1).join("/");

    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`MCP server "${serverName}" not found or failed to initialize`);
    }

    const result = await client.callTool({
      name: toolName,
      arguments: args as any
    });

    return result.content;
  }

  async closeAll() {
    for (const transport of this.transports) {
      try {
        await transport.close();
      } catch (err) {
        // Ignore close errors
      }
    }
    this.clients.clear();
    this.transports = [];
  }
}
