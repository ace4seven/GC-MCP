# gc-mcp Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the Garmin Connect MCP server as `gc-mcp` on npm with a `npx gc-mcp setup` wizard that handles login and Claude Desktop config for non-programmers.

**Architecture:** A new `src/cli.ts` becomes the npm binary entry point. It dispatches three commands: no-args → start MCP server, `login` → re-authenticate, `setup` → interactive wizard. The wizard prompts for Garmin credentials (with hidden password input), calls the existing `login()` in `auth.ts`, then auto-writes the Claude Desktop config. `src/index.ts` is refactored to export a pure `startServer()` function. `src/auth.ts` is updated so `loadClient()` throws instead of calling `process.exit`.

**Tech Stack:** TypeScript, Node.js built-ins (`readline`, `fs`, `os`, `child_process`), `garmin-connect`, `@modelcontextprotocol/sdk`, Vitest for tests.

---

## File Map

| File | Role |
|---|---|
| `package.json` | Rename to `gc-mcp`, add `bin`/`files`, update scripts |
| `src/index.ts` | Export `startServer()` — remove all CLI dispatch logic |
| `src/auth.ts` | `loadClient()` throws `Error` instead of `process.exit` |
| `src/cli.ts` | **New** — binary entry point, all wizard logic |
| `src/__tests__/cli.test.ts` | **New** — unit tests for exported `cli.ts` functions |
| `src/__tests__/auth.test.ts` | **New** — test `loadClient()` throws on failure |

No changes to `src/garmin-client.ts` or `src/tools.ts`.

---

### Task 1: Update `package.json`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Replace `package.json` contents**

```json
{
  "name": "gc-mcp",
  "version": "1.0.0",
  "description": "Garmin Connect MCP server for AI assistants",
  "main": "dist/index.js",
  "bin": {
    "gc-mcp": "./dist/cli.js"
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsc",
    "start": "node dist/cli.js",
    "login": "node dist/cli.js login",
    "setup": "node dist/cli.js setup",
    "test": "vitest run"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "garmin-connect": "^1.6.2",
    "zod": "~3.24"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```
Expected: no errors, `dist/` files regenerated.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: rename package to gc-mcp, add bin and files fields"
```

---

### Task 2: Refactor `src/index.ts` — export `startServer()`

Remove `runLogin()` and all CLI arg dispatch. Export `startServer()` as a named function. Update error messages to reference `npx gc-mcp`.

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Replace `src/index.ts` with**

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { isLoggedIn } from './auth';
import { registerAllTools } from './tools';

export async function startServer(): Promise<void> {
  if (!isLoggedIn()) {
    console.error('No Garmin session found. Run: npx gc-mcp setup');
    process.exit(1);
  }

  const server = new McpServer(
    { name: 'gc-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  registerAllTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "refactor: export startServer() from index.ts, remove CLI dispatch"
```

---

### Task 3: Fix `src/auth.ts` — `loadClient()` throws instead of exits

`loadClient()` currently calls `process.exit(1)` on failure, which prevents callers from handling errors gracefully. Change it to throw.

**Files:**
- Modify: `src/auth.ts`
- Create: `src/__tests__/auth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/auth.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('garmin-connect', () => ({
  GarminConnect: vi.fn().mockImplementation(() => ({
    loadTokenByFile: vi.fn().mockImplementation(() => {
      throw new Error('File not found');
    }),
    exportTokenToFile: vi.fn(),
    login: vi.fn(),
  })),
}));

describe('loadClient', () => {
  it('throws with a helpful message when token loading fails', async () => {
    const { loadClient } = await import('../auth');
    expect(() => loadClient()).toThrow('Session not found');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- src/__tests__/auth.test.ts
```
Expected: FAIL — `loadClient()` currently calls `process.exit`, which is not caught as a thrown error.

- [ ] **Step 3: Update `loadClient` in `src/auth.ts`**

Change the `catch` block only — everything else stays the same:

```ts
export function loadClient(): GarminConnect {
  const gc = new GarminConnect({ username: '', password: '' });
  try {
    gc.loadTokenByFile(TOKEN_DIR);
  } catch {
    throw new Error('Session not found. Run: npx gc-mcp login');
  }
  return gc;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/__tests__/auth.test.ts
```
Expected: PASS

- [ ] **Step 5: Build and run all tests**

```bash
npm run build && npm test
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/auth.ts src/__tests__/auth.test.ts
git commit -m "fix: loadClient throws Error instead of process.exit"
```

---

### Task 4: Create `src/cli.ts` — command dispatcher skeleton

Create the binary entry point with command routing. `login` and `setup` are stubs at this stage.

**Files:**
- Create: `src/cli.ts`
- Create: `src/__tests__/cli.test.ts`

- [ ] **Step 1: Write the failing dispatch test**

Create `src/__tests__/cli.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('cli dispatch', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls startServer when no subcommand is given', async () => {
    vi.spyOn(process, 'argv', 'get').mockReturnValue(['node', 'cli.js']);
    const indexMod = { startServer: vi.fn().mockResolvedValue(undefined) };
    vi.doMock('../index', () => indexMod);

    await import('../cli');

    expect(indexMod.startServer).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- src/__tests__/cli.test.ts
```
Expected: FAIL — `../cli` does not exist yet.

- [ ] **Step 3: Create `src/cli.ts`**

```ts
import * as readline from 'readline';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as childProcess from 'child_process';
import { startServer } from './index';
import { login, isLoggedIn } from './auth';
import { getDisplayName } from './garmin-client';

export async function runLogin(): Promise<void> {
  // implemented in Task 6
  console.log('login — coming soon');
}

export async function runSetup(): Promise<void> {
  // implemented in Tasks 5–9
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/__tests__/cli.test.ts
```
Expected: PASS

- [ ] **Step 5: Build and smoke test**

```bash
npm run build
node dist/cli.js setup
```
Expected: prints "setup — coming soon"

- [ ] **Step 6: Commit**

```bash
git add src/cli.ts src/__tests__/cli.test.ts
git commit -m "feat: add cli.ts binary entry point with command dispatch"
```

---

### Task 5: Implement `checkNodeVersion` with tests

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/__tests__/cli.test.ts`

- [ ] **Step 1: Add the failing tests**

Add to `src/__tests__/cli.test.ts`:

```ts
import { checkNodeVersion } from '../cli';

describe('checkNodeVersion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exits with brew install message when Node < 18', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    checkNodeVersion('v16.14.0');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('brew install node'));
    exitSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('does not exit for Node 18', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    checkNodeVersion('v18.0.0');
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it('does not exit for Node 22', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    checkNodeVersion('v22.3.0');
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test -- src/__tests__/cli.test.ts
```
Expected: FAIL — `checkNodeVersion` not exported yet.

- [ ] **Step 3: Add `checkNodeVersion` to `src/cli.ts`**

Add after the import block, before `runLogin`:

```ts
export function checkNodeVersion(version = process.version): void {
  const major = parseInt(version.replace('v', '').split('.')[0], 10);
  if (major < 18) {
    console.error('Node 18+ required. Install with: brew install node');
    process.exit(1);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/__tests__/cli.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts src/__tests__/cli.test.ts
git commit -m "feat: add checkNodeVersion to setup wizard"
```

---

### Task 6: Implement `runLogin` with hidden password input

Prompts for email (visible) then password (hidden with `•` masking). Calls `login()` from `auth.ts`.

**Files:**
- Modify: `src/cli.ts`

- [ ] **Step 1: Add `readLine` and `readPassword` helpers to `src/cli.ts`**

Add these two functions after the import block, before `checkNodeVersion`. These are internal helpers (not exported — no direct tests needed since they wrap Node built-ins):

```ts
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
      // '\n'/`\r` = Enter, '\u0004' = Ctrl+D (EOF)
      if (c === '\n' || c === '\r' || c === '\u0004') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(password);
      } else if (c === '\u0003') {
        // Ctrl+C — exit cleanly
        process.exit(0);
      } else if (c === '\u007f' || c === '\b') {
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
```

- [ ] **Step 2: Replace the `runLogin` stub**

```ts
export async function runLogin(): Promise<void> {
  const email = await readLine('  Email: ');
  const password = await readPassword('  Password: ');
  process.stdout.write('  Authenticating...');
  await login(email, password);
  process.stdout.write('              ✓ Logged in\n');
}
```

- [ ] **Step 3: Build and manually test**

```bash
npm run build
node dist/cli.js login
```
Expected: prompts for email (characters visible), then password (each character shows `•`), then authenticates.

- [ ] **Step 4: Run all tests**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts
git commit -m "feat: implement login command with hidden password masking"
```

---

### Task 7: Implement `setup` — Node check, token check, and login flow

Replace the `runSetup` stub with the first three wizard steps. `writeClaudeConfig` and `detectClaudeCode` remain as stubs for now.

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/__tests__/cli.test.ts`

- [ ] **Step 1: Add the failing test for `getExistingDisplayName`**

Add to `src/__tests__/cli.test.ts`:

```ts
import { getExistingDisplayName } from '../cli';

describe('getExistingDisplayName', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when not logged in', async () => {
    vi.doMock('../auth', () => ({
      login: vi.fn(),
      isLoggedIn: vi.fn().mockReturnValue(false),
      loadClient: vi.fn(),
      TOKEN_DIR: '/tmp/.garmin-mcp',
    }));
    vi.resetModules();
    const { getExistingDisplayName } = await import('../cli');
    const result = await getExistingDisplayName();
    expect(result).toBeNull();
  });

  it('returns null when getDisplayName throws', async () => {
    vi.doMock('../auth', () => ({
      login: vi.fn(),
      isLoggedIn: vi.fn().mockReturnValue(true),
      loadClient: vi.fn(),
      TOKEN_DIR: '/tmp/.garmin-mcp',
    }));
    vi.doMock('../garmin-client', () => ({
      getDisplayName: vi.fn().mockRejectedValue(new Error('network error')),
    }));
    vi.resetModules();
    const { getExistingDisplayName } = await import('../cli');
    const result = await getExistingDisplayName();
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test -- src/__tests__/cli.test.ts
```
Expected: FAIL — `getExistingDisplayName` not exported.

- [ ] **Step 3: Add `getExistingDisplayName` and the two stubs to `src/cli.ts`**

Add after `checkNodeVersion`:

```ts
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
```

- [ ] **Step 4: Replace the `runSetup` stub**

```ts
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
```

- [ ] **Step 5: Run all tests**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 6: Build and smoke test**

```bash
npm run build
node dist/cli.js setup
```
Expected: prints header, confirms Node version, then either asks about re-auth (if already logged in) or prompts for email/password.

- [ ] **Step 7: Commit**

```bash
git add src/cli.ts src/__tests__/cli.test.ts
git commit -m "feat: setup wizard — Node check, token check, login with retry"
```

---

### Task 8: Implement `writeClaudeConfig`

Auto-writes `~/Library/Application Support/Claude/claude_desktop_config.json` with the `npx -y gc-mcp` entry. Handles four edge cases: no file, existing file, existing `garmin` key (asks to overwrite), malformed JSON (prints manual snippet).

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/__tests__/cli.test.ts`

- [ ] **Step 1: Add the failing tests**

Add to `src/__tests__/cli.test.ts`:

```ts
import { buildClaudeConfig } from '../cli';

describe('buildClaudeConfig', () => {
  const MCP_ENTRY = { command: 'npx', args: ['-y', 'gc-mcp'] };

  it('creates minimal config when existing is null', () => {
    expect(buildClaudeConfig(null)).toEqual({
      mcpServers: { garmin: MCP_ENTRY },
    });
  });

  it('merges garmin into existing mcpServers without touching other keys', () => {
    const existing = {
      mcpServers: { other: { command: 'node', args: ['other.js'] } },
    };
    const result = buildClaudeConfig(existing);
    expect(result.mcpServers.garmin).toEqual(MCP_ENTRY);
    expect(result.mcpServers.other).toEqual({ command: 'node', args: ['other.js'] });
  });

  it('overwrites an existing garmin entry', () => {
    const existing = { mcpServers: { garmin: { command: 'node', args: ['old.js'] } } };
    const result = buildClaudeConfig(existing);
    expect(result.mcpServers.garmin).toEqual(MCP_ENTRY);
  });

  it('handles an object missing the mcpServers key', () => {
    const result = buildClaudeConfig({ otherKey: true });
    expect(result.mcpServers.garmin).toEqual(MCP_ENTRY);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test -- src/__tests__/cli.test.ts
```
Expected: FAIL — `buildClaudeConfig` not exported.

- [ ] **Step 3: Add constants and `buildClaudeConfig` to `src/cli.ts`**

Add after the import block (before `readLine`):

```ts
const CLAUDE_CONFIG_PATH = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'Claude',
  'claude_desktop_config.json'
);

const MCP_ENTRY = { command: 'npx', args: ['-y', 'gc-mcp'] };

export function buildClaudeConfig(existing: Record<string, any> | null): Record<string, any> {
  const config: Record<string, any> = existing ? { ...existing } : {};
  config.mcpServers = { ...(config.mcpServers ?? {}) };
  config.mcpServers.garmin = MCP_ENTRY;
  return config;
}
```

- [ ] **Step 4: Run tests to verify `buildClaudeConfig` tests pass**

```bash
npm test -- src/__tests__/cli.test.ts
```
Expected: PASS

- [ ] **Step 5: Replace the `writeClaudeConfig` stub**

```ts
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
```

- [ ] **Step 6: Build**

```bash
npm run build
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/cli.ts src/__tests__/cli.test.ts
git commit -m "feat: implement writeClaudeConfig — auto-writes Claude Desktop config"
```

---

### Task 9: Implement `detectClaudeCode` + success message

Detects the `claude` CLI binary. If `--claude-code` flag is set, registers unconditionally. If only the binary is detected, prompts first. Always prints the success message at the end.

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/__tests__/cli.test.ts`

- [ ] **Step 1: Add the failing tests**

Add to `src/__tests__/cli.test.ts`:

```ts
import { findClaudeCodeBin } from '../cli';

describe('findClaudeCodeBin', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns trimmed path when claude binary is found', () => {
    vi.spyOn(childProcess, 'execSync').mockReturnValue(
      Buffer.from('/usr/local/bin/claude\n')
    );
    expect(findClaudeCodeBin()).toBe('/usr/local/bin/claude');
  });

  it('returns null when which throws', () => {
    vi.spyOn(childProcess, 'execSync').mockImplementation(() => {
      throw new Error('not found');
    });
    expect(findClaudeCodeBin()).toBeNull();
  });
});
```

Add the import at the top of `src/__tests__/cli.test.ts`:

```ts
import * as childProcess from 'child_process';
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test -- src/__tests__/cli.test.ts
```
Expected: FAIL — `findClaudeCodeBin` not exported.

- [ ] **Step 3: Add `findClaudeCodeBin` to `src/cli.ts`**

Add after `buildClaudeConfig`:

```ts
export function findClaudeCodeBin(): string | null {
  try {
    return childProcess.execSync('which claude', { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Replace the `detectClaudeCode` stub**

```ts
export async function detectClaudeCode(
  flag = process.argv.includes('--claude-code')
): Promise<void> {
  if (flag) {
    process.stdout.write('  Configuring Claude Code CLI...');
    childProcess.execSync('claude mcp add gc-mcp -- npx -y gc-mcp', { stdio: 'inherit' });
    process.stdout.write('  ✓ Registered\n');
  } else {
    const bin = findClaudeCodeBin();
    if (bin) {
      const answer = await readLine(
        '  Claude Code CLI detected — also configure for Claude Code? (Y/n) '
      );
      if (answer.toLowerCase() !== 'n') {
        childProcess.execSync('claude mcp add gc-mcp -- npx -y gc-mcp', { stdio: 'inherit' });
        process.stdout.write('  ✓ Claude Code CLI configured\n');
      }
    }
  }

  console.log('\n  Done! Restart Claude Desktop and ask: "How was my sleep last night?"\n');
}
```

- [ ] **Step 5: Run all tests**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 6: Build**

```bash
npm run build
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/cli.ts src/__tests__/cli.test.ts
git commit -m "feat: implement Claude Code detection and success message"
```

---

### Task 10: End-to-end verification + README update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run full test suite**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 2: Verify all binary commands are reachable**

```bash
npm run build
node dist/cli.js setup --help 2>&1 || node dist/cli.js setup
```
Expected: wizard starts (prints header and Node version).

```bash
node dist/cli.js login 2>&1 | head -2
```
Expected: prompts "  Email:" (or immediately prompts — either is fine).

```bash
node dist/cli.js 2>&1
```
Expected: either starts the MCP server or prints "No Garmin session found. Run: npx gc-mcp setup".

- [ ] **Step 3: Replace the Installation section in `README.md`**

Find lines 29–66 (the `## Installation` section through step 5 "Restart Claude Desktop"). Replace with:

```markdown
## Installation

Run this in your terminal:

```bash
npx gc-mcp setup
```

The wizard will:
1. Ask for your Garmin Connect email and password
2. Save authentication tokens to `~/.garmin-mcp/` on your machine
3. Auto-configure Claude Desktop

Then restart Claude Desktop — you're done.

### When tokens expire

Garmin sessions expire periodically. Run this to re-authenticate:

```bash
npx gc-mcp login
```

### Claude Code CLI

```bash
npx gc-mcp setup --claude-code
```
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: update README with npx gc-mcp setup installation"
```
