#!/usr/bin/env node
import * as readline from 'readline';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as childProcess from 'child_process';
import { startServer } from './index';
import { login, isLoggedIn } from './auth';
import { getDisplayName } from './garmin-client';

const MCP_ENTRY = { command: 'npx', args: ['-y', '@ace4seven/gc-mcp'] };
const ZED_ENTRY = { source: 'custom', ...MCP_ENTRY };

// ── client table ────────────────────────────────────────────────────────────

export interface McpClientDef {
  id: string;
  name: string;
  configPath: string;
  serverKey: string;
  entry: Record<string, any>;
  isInstalled: () => boolean;
}

function isBinAvailable(bin: string): boolean {
  try {
    const cmd = process.platform === 'win32' ? `where ${bin}` : `which ${bin}`;
    childProcess.execSync(cmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function claudeDesktopConfigPath(): string {
  const home = os.homedir();
  if (process.platform === 'win32') return path.join(process.env.APPDATA ?? home, 'Claude', 'claude_desktop_config.json');
  if (process.platform === 'linux') return path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
  return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
}

function vsCodeConfigPath(): string {
  const home = os.homedir();
  if (process.platform === 'win32') return path.join(process.env.APPDATA ?? home, 'Code', 'User', 'mcp.json');
  if (process.platform === 'linux') return path.join(home, '.config', 'Code', 'User', 'mcp.json');
  return path.join(home, 'Library', 'Application Support', 'Code', 'User', 'mcp.json');
}

export const CLIENTS: McpClientDef[] = (() => {
  const home = os.homedir();
  const isDarwin = process.platform === 'darwin';
  return [
    {
      id: 'claude-desktop',
      name: 'Claude Desktop',
      configPath: claudeDesktopConfigPath(),
      serverKey: 'mcpServers',
      entry: MCP_ENTRY,
      isInstalled: () =>
        fs.existsSync(path.dirname(claudeDesktopConfigPath())) ||
        (isDarwin && fs.existsSync('/Applications/Claude.app')),
    },
    {
      id: 'cursor',
      name: 'Cursor',
      configPath: path.join(home, '.cursor', 'mcp.json'),
      serverKey: 'mcpServers',
      entry: MCP_ENTRY,
      isInstalled: () =>
        fs.existsSync(path.join(home, '.cursor')) ||
        (isDarwin && fs.existsSync('/Applications/Cursor.app')) ||
        isBinAvailable('cursor'),
    },
    {
      id: 'windsurf',
      name: 'Windsurf',
      configPath: path.join(home, '.codeium', 'windsurf', 'mcp_config.json'),
      serverKey: 'mcpServers',
      entry: MCP_ENTRY,
      isInstalled: () =>
        fs.existsSync(path.join(home, '.codeium', 'windsurf')) ||
        (isDarwin && fs.existsSync('/Applications/Windsurf.app')) ||
        isBinAvailable('windsurf'),
    },
    {
      id: 'vscode',
      name: 'VS Code',
      configPath: vsCodeConfigPath(),
      serverKey: 'servers',
      entry: MCP_ENTRY,
      isInstalled: () =>
        fs.existsSync(path.dirname(vsCodeConfigPath())) ||
        (isDarwin && fs.existsSync('/Applications/Visual Studio Code.app')) ||
        isBinAvailable('code'),
    },
    {
      id: 'zed',
      name: 'Zed',
      configPath: path.join(home, '.config', 'zed', 'settings.json'),
      serverKey: 'context_servers',
      entry: ZED_ENTRY,
      isInstalled: () =>
        fs.existsSync(path.join(home, '.config', 'zed')) ||
        (isDarwin && fs.existsSync('/Applications/Zed.app')) ||
        isBinAvailable('zed'),
    },
  ];
})();

// ── config builders ─────────────────────────────────────────────────────────

export function buildMcpServerConfig(
  existing: Record<string, any> | null,
  serverKey: string,
  entry: Record<string, any>
): Record<string, any> {
  const config: Record<string, any> = existing ? { ...existing } : {};
  config[serverKey] = { ...(config[serverKey] ?? {}) };
  config[serverKey].garmin = entry;
  return config;
}

// backward compat
export function buildClaudeConfig(existing: Record<string, any> | null): Record<string, any> {
  return buildMcpServerConfig(existing, 'mcpServers', MCP_ENTRY);
}

// ── readline helpers ────────────────────────────────────────────────────────

function readLine(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

export function readPassword(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) {
    return readLine(prompt);
  }
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    let password = '';
    const onData = (chunk: Buffer) => {
      const c = chunk.toString();
      if (c === '\n' || c === '\r' || c === '\x04') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(password);
      } else if (c === '\x03') {
        process.exit(0);
      } else if (c === '\x7f' || c === '\b') {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        password += c;
        process.stdout.write('•');
      }
    };
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

// ── Node version check ──────────────────────────────────────────────────────

export function checkNodeVersion(version = process.version): void {
  const major = parseInt(version.replace('v', '').split('.')[0], 10);
  if (major < 18) {
    console.error('Node 18+ required. Install with: brew install node');
    process.exit(1);
  }
}

// ── auth ────────────────────────────────────────────────────────────────────

export async function runLogin(): Promise<void> {
  const email = await readLine('  Email: ');
  const password = await readPassword('  Password: ');
  process.stdout.write('  Authenticating...');
  await login(email, password);
  process.stdout.write('              ✓ Logged in\n');
}

export async function getExistingDisplayName(): Promise<string | null> {
  if (!isLoggedIn()) return null;
  try {
    return await getDisplayName();
  } catch {
    return null;
  }
}

// ── config writing ──────────────────────────────────────────────────────────

export async function writeJsonConfig(client: McpClientDef): Promise<void> {
  const { configPath, serverKey, entry, name } = client;
  process.stdout.write(`  Configuring ${name}...`);

  let existing: Record<string, any> | null = null;

  if (fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {
      process.stdout.write('\n');
      console.error(`  Could not parse ${configPath}`);
      console.error('  Add this manually:');
      console.log(JSON.stringify({ [serverKey]: { garmin: entry } }, null, 2));
      return;
    }
  }

  if (existing?.[serverKey]?.garmin != null) {
    process.stdout.write('\n');
    const answer = await readLine(`  Overwrite existing garmin config in ${name}? (y/N) `);
    if (answer.toLowerCase() !== 'y') {
      process.stdout.write(`  Skipping ${name} config.\n`);
      return;
    }
    process.stdout.write(`  Configuring ${name}...`);
  }

  const updated = buildMcpServerConfig(existing, serverKey, entry);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(updated, null, 2) + '\n');
  process.stdout.write(' ✓ Written\n');
}

// backward compat
export async function writeClaudeConfig(): Promise<void> {
  return writeJsonConfig(CLIENTS.find(c => c.id === 'claude-desktop')!);
}

// ── Claude Code CLI ─────────────────────────────────────────────────────────

export function findClaudeCodeBin(): string | null {
  try {
    return childProcess.execSync('which claude', { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

export async function detectClaudeCode(
  flag = process.argv.includes('--claude-code')
): Promise<void> {
  if (flag) {
    process.stdout.write('  Configuring Claude Code CLI...');
    childProcess.execSync('claude mcp add gc-mcp -- npx -y @ace4seven/gc-mcp', { stdio: 'inherit' });
    process.stdout.write('  ✓ Registered\n');
    return;
  }
  const bin = findClaudeCodeBin();
  if (bin) {
    const answer = await readLine(
      '  Claude Code CLI detected — also configure for Claude Code? (Y/n) '
    );
    if (answer.toLowerCase() !== 'n') {
      childProcess.execSync('claude mcp add gc-mcp -- npx -y @ace4seven/gc-mcp', { stdio: 'inherit' });
      process.stdout.write('  ✓ Claude Code CLI configured\n');
    }
  }
}

// ── setup ───────────────────────────────────────────────────────────────────

async function configureClients(): Promise<void> {
  const detected = CLIENTS.filter(c => c.isInstalled());

  if (detected.length === 0) {
    console.log('\n  No supported AI clients detected.');
    console.log('  Supported: Claude Desktop, Cursor, Windsurf, VS Code, Zed');
    console.log('  Install one and re-run setup, or configure manually:\n');
    console.log(JSON.stringify({ mcpServers: { garmin: MCP_ENTRY } }, null, 2));
    console.log();
  } else {
    for (const client of detected) {
      await writeJsonConfig(client);
    }
  }

  await detectClaudeCode();
  console.log('\n  Done! Restart any configured AI client and ask: "How was my sleep last night?"\n');
}

export async function runSetup(): Promise<void> {
  console.log('\n  gc-mcp — Garmin Connect for AI assistants\n');

  process.stdout.write('  Checking Node version...     ');
  checkNodeVersion();
  process.stdout.write(`✓ ${process.version}\n`);

  const existingName = await getExistingDisplayName();
  const alreadyLoggedIn = isLoggedIn();

  if (alreadyLoggedIn) {
    const label = existingName ? `Already logged in as ${existingName}` : 'Already logged in';
    const answer = await readLine(`  ${label}. Re-authenticate? (y/N) `);
    if (answer.toLowerCase() !== 'y') {
      await configureClients();
      return;
    }
  }

  let retries = 0;
  while (retries <= 1) {
    try {
      const email = await readLine('  Email: ');
      const password = await readPassword('  Password: ');
      process.stdout.write('  Authenticating...');
      await login(email, password);
      process.stdout.write('              ✓ Logged in\n');
      break;
    } catch (e: any) {
      process.stdout.write('\n');
      console.error(`  Login failed: ${e?.message ?? e}`);
      if (retries === 1) {
        console.error('  Check your Garmin Connect email and password, then run again.');
        process.exit(1);
      }
      console.error('  Trying once more...');
      retries++;
    }
  }

  await configureClients();
}

const command = process.argv[2];
if (command === 'setup') {
  runSetup().catch(e => { console.error(e); process.exit(1); });
} else if (command === 'login') {
  runLogin().catch(e => { console.error(e); process.exit(1); });
} else {
  startServer().catch(e => { console.error(e); process.exit(1); });
}
