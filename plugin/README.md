# gc-coach

AI fitness coach for Claude Code, built on top of `@ace4seven/gc-mcp` (Garmin Connect MCP server).

## What it does

- **/coach-onboard** — bootstraps your athlete profile from 90 days of Garmin data.
- **/coach-today** — readiness-aware "what should I do today?" decision.
- **/coach-checkin** — frictionless subjective daily log (energy, soreness, sleep, RPE).
- **/coach-plan-week** — periodised week with rationale per session.
- **/coach-review** — weekly retrospective with red-flag sweep.

Eight skills carry the coaching IQ — `coach-core` (the constitution), `daily-advisor`, `weekly-planner`, `pattern-detective`, `recovery-advisor`, `endurance-block`, `strength-block`, `onboarding`.

State lives in `~/.gc-mcp/coach/` as readable markdown + JSON. You own it.

## Prerequisites

1. Run the MCP server's one-time setup:
   ```bash
   npx @ace4seven/gc-mcp setup
   ```
   This writes Garmin OAuth tokens to `~/.gc-mcp/`.

2. Re-authenticate when tokens expire:
   ```bash
   npx @ace4seven/gc-mcp login
   ```

## Install

From a local clone:

```
/plugin install /absolute/path/to/garmin-mcp/plugin
```

Then start a conversation with `/coach-onboard`.

## Privacy

Everything is local. The plugin reads/writes only files in `~/.gc-mcp/coach/` and your Garmin Connect account. No telemetry, no external calls beyond Garmin itself.

## License

MIT.
