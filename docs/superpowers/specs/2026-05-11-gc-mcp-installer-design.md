# gc-mcp Installer Design

**Date:** 2026-05-11  
**Status:** Approved

## Goal

Make the Garmin Connect MCP server installable by non-programmers with a single terminal command. Rename the package to `gc-mcp` (brand-safe, agent-agnostic) and publish to npm.

---

## User Experience

**First-time install:**
```
npx gc-mcp setup
```
Prompts for Garmin credentials, authenticates, and auto-writes the Claude Desktop config. User restarts Claude Desktop and is done.

**Token expiry (ongoing):**
```
npx gc-mcp login
```

**Claude Code CLI:**
```
npx gc-mcp setup --claude-code
```

---

## Commands

| Command | Behavior |
|---|---|
| `npx gc-mcp` | Start MCP server over stdio (called by Claude Desktop) |
| `npx gc-mcp setup` | One-time setup wizard: login + config write |
| `npx gc-mcp setup --claude-code` | Setup + register via `claude mcp add` |
| `npx gc-mcp login` | Re-authenticate only, no config changes |

---

## Package Changes

### `package.json`
- `name`: `gc-mcp`
- Add `bin`: `{ "gc-mcp": "./dist/cli.js" }`
- Add `files`: `["dist"]` — publish only compiled output
- Keep existing `dependencies` and `devDependencies` unchanged

### New file: `src/cli.ts`
Entry point for the `gc-mcp` binary. Parses `process.argv` and dispatches:
- No args → import and call the MCP server start function from `src/index.ts`
- `setup` → run the setup wizard
- `login` → run login only

### Modified: `src/index.ts`
Extract the server startup logic into an exported `startServer()` function so `cli.ts` can call it without re-running the CLI arg logic.

---

## Setup Wizard Flow (`src/cli.ts` — `setup` command)

Steps run top-to-bottom. Each step prints a status line.

1. **Node version check**
   - Read `process.version`, require `>=18.0.0`
   - If below: print `"Node 18+ required. Install with: brew install node"` and exit

2. **Existing token check**
   - If `~/.garmin-mcp/oauth1_token.json` and `oauth2_token.json` exist: attempt to load display name; prompt `"Already logged in as [displayName]. Re-authenticate? (y/N)"` if name loads, otherwise `"Already logged in. Re-authenticate? (y/N)"`
   - If user says no: skip login step

3. **Login prompt**
   - readline for email
   - Hidden input (raw mode `process.stdin`) for password
   - Call existing `login()` from `auth.ts`
   - On failure: show error message, offer one retry, then exit with instructions

4. **Claude Desktop config write**
   - Config path: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - If file missing: create with `{ "mcpServers": { "garmin": { ... } } }`
   - If file exists: parse JSON, merge `mcpServers.garmin` key
   - If `garmin` key already present: prompt `"Overwrite existing garmin config? (y/N)"`
   - If JSON is malformed: print path, print manual snippet, continue without crashing

5. **Claude Code CLI**
   - If `--claude-code` flag passed: run `claude mcp add gc-mcp -- npx -y gc-mcp` via `execSync`
   - If `--claude-code` not passed but `claude` binary is detected in PATH: prompt `"Claude Code CLI detected — also configure for Claude Code? (Y/n)"` and run if confirmed

6. **Success message**
   - Print: `"Done! Restart Claude Desktop and ask: 'How was my sleep last night?'"`

### Claude Desktop config entry written
```json
{
  "mcpServers": {
    "garmin": {
      "command": "npx",
      "args": ["-y", "gc-mcp"]
    }
  }
}
```
No absolute paths — works on any machine without customization.

---

## Token Expiry Handling

- `npx gc-mcp login` — re-runs login only, no config changes
- MCP server startup: if `loadClient()` throws an auth error, print to stderr: `"Session expired — run: npx gc-mcp login"` before exiting

---

## Publishing

- Package name: `gc-mcp`
- Visibility: public
- First publish: `npm publish --access public`
- Version bumps: `npm version patch && npm publish`
- Only `dist/` is included in the published package

---

## Files Changed

| File | Change |
|---|---|
| `package.json` | Rename to `gc-mcp`, add `bin` and `files` fields |
| `src/cli.ts` | New — binary entry point, setup wizard |
| `src/index.ts` | Extract `startServer()` as exported function |

No changes to `auth.ts`, `garmin-client.ts`, or `tools.ts`.

---

## Constraints

- macOS only
- Requires Node 18+ (checked at runtime, not auto-installed)
- Credentials collected via interactive terminal prompt, never stored
- Tokens stored in `~/.garmin-mcp/` (unchanged from current behavior)
