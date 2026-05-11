#!/usr/bin/env node
import * as readline from 'readline';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as childProcess from 'child_process';
import { startServer } from './index';
import { login, isLoggedIn } from './auth';
import { getDisplayName } from './garmin-client';

const CLAUDE_CONFIG_PATH = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'Claude',
  'claude_desktop_config.json'
);

const MCP_ENTRY = { command: 'npx', args: ['-y', '@ace4seven/gc-mcp'] };

export function buildClaudeConfig(existing: Record<string, any> | null): Record<string, any> {
  const config: Record<string, any> = existing ? { ...existing } : {};
  config.mcpServers = { ...(config.mcpServers ?? {}) };
  config.mcpServers.garmin = MCP_ENTRY;
  return config;
}

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
      // '\n'/'\r' = Enter, '\x04' = Ctrl+D (EOF)
      if (c === '\n' || c === '\r' || c === '\x04') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(password);
      } else if (c === '\x03') {
        // Ctrl+C — exit cleanly
        process.exit(0);
      } else if (c === '\x7f' || c === '\b') {
        // Backspace / Delete
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

export function checkNodeVersion(version = process.version): void {
  const major = parseInt(version.replace('v', '').split('.')[0], 10);
  if (major < 18) {
    console.error('Node 18+ required. Install with: brew install node');
    process.exit(1);
  }
}

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

export async function writeClaudeConfig(): Promise<void> {
  process.stdout.write('  Configuring Claude Desktop...');

  let existing: Record<string, any> | null = null;

  if (fs.existsSync(CLAUDE_CONFIG_PATH)) {
    try {
      existing = JSON.parse(fs.readFileSync(CLAUDE_CONFIG_PATH, 'utf-8'));
    } catch {
      process.stdout.write('\n');
      console.error(`  Could not parse ${CLAUDE_CONFIG_PATH}`);
      console.error('  Add this to it manually:');
      console.log(JSON.stringify({ mcpServers: { garmin: MCP_ENTRY } }, null, 2));
      return;
    }
  }

  if (existing?.mcpServers?.garmin != null) {
    process.stdout.write('\n');
    const answer = await readLine('  Overwrite existing garmin config? (y/N) ');
    if (answer.toLowerCase() !== 'y') {
      process.stdout.write('  Skipping Claude Desktop config.\n');
      return;
    }
    process.stdout.write('  Configuring Claude Desktop...');
  }

  const updated = buildClaudeConfig(existing);
  fs.mkdirSync(path.dirname(CLAUDE_CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CLAUDE_CONFIG_PATH, JSON.stringify(updated, null, 2) + '\n');
  process.stdout.write(' ✓ Written\n');
}

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
  } else {
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

  console.log('\n  Done! Restart Claude Desktop and ask: "How was my sleep last night?"\n');
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
      await writeClaudeConfig();
      await detectClaudeCode();
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

  await writeClaudeConfig();
  await detectClaudeCode();
}

const command = process.argv[2];
if (command === 'setup') {
  runSetup().catch(e => { console.error(e); process.exit(1); });
} else if (command === 'login') {
  runLogin().catch(e => { console.error(e); process.exit(1); });
} else {
  startServer().catch(e => { console.error(e); process.exit(1); });
}
