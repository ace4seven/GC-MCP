# GC-MCP

> **Disclaimer:** GC-MCP is an independent, community-made project. It is not affiliated with, endorsed by, or created by Garmin Ltd. Garmin and Garmin Connect are trademarks of Garmin Ltd.

A [Model Context Protocol](https://modelcontextprotocol.io) server that connects AI assistants to your [Garmin Connect](https://connect.garmin.com) account. Ask about your health metrics, training load, activities, and trends — directly from conversation.

---

## Installation (Required)

**The MCP server must be installed before anything else — including the gc-coach plugin — will work.**

Run this in your terminal:

```bash
npx @ace4seven/gc-mcp setup
```

The wizard will:
1. Ask for your Garmin Connect email and password
2. Save authentication tokens to `~/.gc-mcp/` on your machine
3. Detect all installed AI clients and configure each one automatically

Then **restart any configured AI client** — you're done.

Supported clients: **Claude Desktop, Cursor, Windsurf, VS Code, Zed, Claude Code CLI**

### Re-authenticate when tokens expire

```bash
npx @ace4seven/gc-mcp login
```

---

## What You Can Ask

Once configured, ask your AI assistant things like:

- *"How was my sleep last week?"*
- *"Show me my HRV trend for the past 30 days"*
- *"What was my resting heart rate on Monday?"*
- *"List my last 10 runs with pace and distance"*

---

## gc-coach Plugin (Optional)

An optional Claude Code plugin that turns Claude into a personalised fitness coach with persistent memory, daily readiness decisions, weekly planning, and automatic red-flag detection.

> **Requires the MCP server to be installed first** (see [Installation](#installation-required) above).

### Install

```
/plugin marketplace add ace4seven/GC-MCP
/plugin install gc-coach@gc-mcp-marketplace
```

### Slash Commands

| Command | Description |
|---|---|
| `/coach-onboard` | First-run setup. Infers an athlete profile from 90 days of Garmin data, confirms with 5 questions, and writes a conservative starter training block. |
| `/coach-today` | Morning decision. Reads today's readiness, HRV, sleep, and body battery; cross-checks the weekly plan; outputs one prescription + fallback. |
| `/coach-checkin` | Daily log. Asks energy, soreness, sleep, session done, and RPE in a single prompt. Detects patterns and opens flags automatically. |
| `/coach-plan-week` | Builds a periodised Monday–Sunday week with session rationale. Saves to `weekly-plan.md`. |
| `/coach-review` | Weekly retrospective. Reports adherence, load trajectory, opened/closed flags, and exactly one thing to change next week. |

### State Files

All coaching state is stored locally in `~/.gc-mcp/coach/` — no cloud sync.

```
~/.gc-mcp/coach/
├── profile.json          # Athlete profile (modalities, baselines, voice prefs)
├── goals.md              # Goals in the athlete's own words
├── current-block.md      # Active training block description
├── weekly-plan.md        # Current week's session plan
├── flags.md              # Active and closed red flags
├── daily-log/
│   └── YYYY-MM-DD.md     # Per-day check-in
└── history/
    └── YYYY-Wnn-review.md  # Weekly retrospective archive
```

---

## Available Tools

### Daily Health

| Tool | Description | Parameters |
|---|---|---|
| `get_daily_summary` | Steps, calories, floors, active minutes, and distance | `start_date?`, `end_date?` |
| `get_heart_rate` | Resting heart rate and intraday HR curve | `start_date?`, `end_date?` |
| `get_stress` | Average/max stress levels and timeline | `start_date?`, `end_date?` |
| `get_body_battery` | Energy charge/drain curve | `start_date?`, `end_date?` |
| `get_sleep_data` | Deep/light/REM/awake breakdown, sleep score, SpO2 | `start_date?`, `end_date?` |
| `get_hrv_status` | Nightly HRV score and 5-night rolling average | `start_date?`, `end_date?` |
| `get_respiration` | Breathing rate throughout the day | `start_date?`, `end_date?` |
| `get_spo2` | Blood oxygen readings | `start_date?`, `end_date?` |
| `get_hydration` | Water intake log | `start_date?`, `end_date?` |

### Fitness & Performance

| Tool | Description | Parameters |
|---|---|---|
| `get_training_status` | Fitness level: peaking, productive, maintaining, etc. | `start_date?`, `end_date?` |
| `get_training_readiness` | Readiness score with contributing factors | `start_date?`, `end_date?` |
| `get_training_load` | Acute vs chronic load balance (ACWR) over 28 days | `date?` |
| `get_vo2max` | VO2 max estimate for running and cycling | `date?` |
| `get_race_predictor` | Predicted 5K, 10K, half marathon, marathon times | — |
| `get_personal_records` | All-time personal records across all sport types | — |

### Activities

| Tool | Description | Parameters |
|---|---|---|
| `list_activities` | List activities with summary stats | `limit?` (1–100), `sport_type?`, `start_date?`, `end_date?` |
| `get_activity` | Full details for a single activity | `activity_id` (required) |
| `get_activity_splits` | Lap/split data for a single activity | `activity_id` (required) |

### Body Composition

| Tool | Description | Parameters |
|---|---|---|
| `get_body_composition` | BMI, body fat percentage, and muscle mass | `start_date?`, `end_date?` |
| `get_weight_history` | Weight measurements over a date range | `start_date` (required), `end_date` (required) |

### Gear & Profile

| Tool | Description | Parameters |
|---|---|---|
| `list_gear` | Shoes, bikes, and other gear with usage mileage | — |
| `get_user_profile` | Display name, date of birth, weight, preferred units | — |

### Date Range Support

Most tools accept optional `start_date` and `end_date` (`YYYY-MM-DD` format, max 90-day range). Omit both for today's data.

---

## Troubleshooting

**"Missing credentials" error** — Run `npx @ace4seven/gc-mcp login` to authenticate.

**Tools not appearing** — Re-run `npx @ace4seven/gc-mcp setup`, then fully restart your AI client.

**Authentication expired** — Run `npx @ace4seven/gc-mcp login` again and restart your AI client.

**"Tool result is too large"** — Use a shorter date range, or ask about a specific metric rather than fetching everything at once.

---

## Privacy

- Your Garmin credentials are used only during login and are never stored.
- OAuth tokens are stored locally in `~/.gc-mcp/` on your machine.
- All Garmin API requests are made directly from your machine — no data passes through any intermediary server.

---

## Development

### Project Structure

```
src/
  cli.ts                   # Binary entry point — setup/login/server dispatch
  index.ts                 # MCP server: startServer()
  auth.ts                  # Token I/O: login(), loadClient(), isLoggedIn()
  garmin-client.ts         # One fetch* function per tool + range helpers
  tools.ts                 # MCP tool registration
  coach/
    state.ts               # Coach state I/O (~/.gc-mcp/coach/*)
    load-summary.ts        # ACWR + modality load computation
    readiness-synthesis.ts # Readiness fusion (HRV, sleep, body battery)

plugin/                    # gc-coach Claude Code plugin
  .claude-plugin/
  commands/
  skills/
```

### Commands

```bash
npm run build       # Compile TypeScript → dist/
npm run setup       # Run the setup wizard
npm run login       # Re-authenticate with Garmin
npm test            # Run unit tests with Vitest
npx tsc --noEmit    # Type-check without emitting files
```

### Adding a New Tool

1. Add a `fetch*` function in `src/garmin-client.ts`
2. Register it in `src/tools.ts` following the existing `try/catch` pattern
3. Run `npm run build`

---

## License

MIT
