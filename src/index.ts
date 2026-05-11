import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { isLoggedIn } from './auth';
import { registerAllTools } from './tools';

export async function startServer(): Promise<void> {
  if (!isLoggedIn()) {
    console.error('No session found. Run: npx gc-mcp setup');
    process.exit(1);
  }

  const server = new McpServer(
    { name: 'gc-mcp', version: '0.0.1' },
    { capabilities: { tools: {} } }
  );

  registerAllTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
