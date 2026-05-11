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

export async function runSetup(): Promise<void> {
  // implemented in Tasks 7–9
  console.log('setup — coming soon');
}

const command = process.argv[2];
if (command === 'setup') {
  runSetup().catch(e => { console.error(e); process.exit(1); });
} else if (command === 'login') {
  runLogin().catch(e => { console.error(e); process.exit(1); });
} else {
  startServer().catch(e => { console.error(e); process.exit(1); });
}
