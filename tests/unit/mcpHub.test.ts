import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpHub } from '../../src/tools/mcpHub';

// Mock MCP SDK
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  return {
    Client: vi.fn().mockImplementation(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      callTool: vi.fn().mockImplementation(({ name }) => {
        if (name === 'get_forecast') {
          return Promise.resolve({ content: [{ type: 'text', text: 'Sunny' }] });
        }
        return Promise.resolve({ content: [] });
      })
    }))
  };
});

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => {
  return {
    StdioClientTransport: vi.fn().mockImplementation(() => ({
      close: vi.fn().mockResolvedValue(undefined)
    }))
  };
});

describe('McpHub', () => {
  const configs = {
    weather: { command: 'node', args: ['weather.js'] },
    calculator: { command: 'node', args: ['calc.js'] }
  };

  let hub: McpHub;

  beforeEach(() => {
    hub = new McpHub(configs);
  });

  it('should initialize all servers in parallel', async () => {
    await hub.initialize();
    // Verification via logs or internal state if exposed
  });

  it('should route callTool to the correct server', async () => {
    await hub.initialize();
    const result = await hub.callTool('weather/get_forecast', { city: 'London' });
    expect(result).toEqual([{ type: 'text', text: 'Sunny' }]);
  });

  it('should throw error when server not found', async () => {
    await hub.initialize();
    await expect(hub.callTool('unknown/tool', {})).rejects.toThrow(/not found/);
  });

  it('should close all servers', async () => {
    await hub.initialize();
    await hub.closeAll();
  });
});
