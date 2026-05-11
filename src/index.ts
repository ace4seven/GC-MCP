import * as readline from 'readline';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { login, isLoggedIn } from './auth';
import { registerAllTools } from './tools';

async function runLogin(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>(res => rl.question(q, res));

  const username = await ask('Garmin username (email): ');
  const password = await ask('Garmin password: ');
  rl.close();

  await login(username, password);
  process.exit(0);
}

async function runServer(): Promise<void> {
  if (!isLoggedIn()) {
    console.error('No Garmin session found. Run: node dist/index.js --login');
    process.exit(1);
  }

  const server = new McpServer(
    { name: 'garmin-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  registerAllTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const args = process.argv.slice(2);
if (args.includes('--login')) {
  runLogin().catch(e => { console.error(e); process.exit(1); });
} else {
  runServer().catch(e => { console.error(e); process.exit(1); });
}
