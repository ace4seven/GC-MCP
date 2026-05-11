import * as readline from 'readline';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as childProcess from 'child_process';
import { startServer } from './index';
import { login, isLoggedIn } from './auth';
import { getDisplayName } from './garmin-client';

export function checkNodeVersion(version = process.version): void {
  const major = parseInt(version.replace('v', '').split('.')[0], 10);
  if (major < 18) {
    console.error('Node 18+ required. Install with: brew install node');
    process.exit(1);
  }
}

export async function runLogin(): Promise<void> {
  // implemented in Task 6
  console.log('login — coming soon');
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
