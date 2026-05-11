import * as readline from 'readline';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as childProcess from 'child_process';
import { startServer } from './index';
import { login, isLoggedIn } from './auth';
import { getDisplayName } from './garmin-client';

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
  // implemented in Task 8
}

export async function detectClaudeCode(
  flag = process.argv.includes('--claude-code')
): Promise<void> {
  // implemented in Task 9
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
