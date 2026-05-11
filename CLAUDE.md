# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build        # compile TypeScript → dist/
npm run setup        # setup wizard: login + configure Claude Desktop
npm run login        # re-authenticate (prompts for Garmin credentials, saves tokens)
npm start            # start MCP server over stdio (requires prior login)
npx tsc --noEmit     # type-check without emitting files
```

After any source change, run `npm run build` before testing — Claude Desktop and smoke tests run from `dist/`.

Smoke-test a single function without starting the full server:
```bash
node -e "const { fetchUserProfile } = require('./dist/garmin-client'); fetchUserProfile().then(d => console.log(JSON.stringify(d, null, 2))).catch(console.error);"
```

## Architecture

Four source files with a strict dependency order:

```
cli.ts → index.ts → tools.ts → garmin-client.ts → auth.ts
```

**`src/cli.ts`** — binary entry point (`gc-mcp` bin). Dispatches: no args → `startServer()`, `setup` → wizard, `login` → re-auth. Contains the full setup wizard: Node version check, existing token check, hidden-password login prompt, Claude Desktop config write (`buildClaudeConfig`/`writeClaudeConfig`), Claude Code CLI detection.

**`src/index.ts`** — exports `startServer()`. Checks `isLoggedIn()`, creates `McpServer`, registers all tools, connects `StdioServerTransport`. No CLI logic.

**`src/auth.ts`** — token I/O only. `login()` authenticates and writes two files to `~/.gc-mcp/` (`oauth1_token.json`, `oauth2_token.json`) via `gc.exportTokenToFile()`. `loadClient()` reconstructs a client from those files using `gc.loadTokenByFile()` — throws `Error` (not `process.exit`) if tokens are missing. Must pass `{ username: '', password: '' }` to the `GarminConnect` constructor even when loading from file.

**`src/garmin-client.ts`** — one exported `fetch*` function per MCP tool, plus a module-level singleton client and cached `displayName`. All Garmin API calls go through `gc.get(url, { params: {...} })` (axios-style) or a handful of convenience methods (`getHeartRate`, `getSleepData`, `getActivity`). The API base is `https://connectapi.garmin.com`. Five endpoints embed `displayName` in the URL path (daily summary, training load, VO2 max, race predictor, personal records) — these call `await getDisplayName()` which fetches once from `getUserProfile()` and caches the result.

**`src/tools.ts`** — `registerAllTools(server)` wires each `fetch*` function to an MCP tool name. All handlers follow the same pattern: `try { return ok(data) } catch (e) { return err(e, 'CODE') }`. The `ok()`/`err()` helpers return `CallToolResult` from the SDK. Two `@ts-expect-error TS2589` markers exist on specific `registerTool` calls — this is a known TypeScript instantiation-depth issue between Zod ~3.24 and MCP SDK 1.29, not a logic error. Do not remove them without verifying the depth issue is resolved upstream.

## Claude Desktop config

Server entry in `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
"garmin": {
  "command": "node",
  "args": ["/Users/jmacak/Developer/7-MCP-servers/garmin-mcp/dist/cli.js"]
}
```

**Important:** After the refactor, `dist/index.js` only exports `startServer()` — it no longer auto-starts when run directly. Claude Desktop must point to `dist/cli.js`.

After modifying source, rebuild and restart Claude Desktop for changes to take effect.

## Adding a new tool

1. Add a `fetch*` function in `garmin-client.ts`
2. Add a `server.registerTool(...)` call in `tools.ts` following the existing try/catch pattern
3. `npm run build`

No registration elsewhere is needed — `registerAllTools` is called once at server startup.
