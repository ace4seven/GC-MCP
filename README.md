# Garmin MCP

A [Model Context Protocol](https://modelcontextprotocol.io) server that connects Claude to your [Garmin Connect](https://connect.garmin.com) account. Ask Claude about your health metrics, training load, activities, and trends — directly from conversation.

---

## What It Does

Once configured, you can ask Claude things like:

- *"How was my sleep last week?"*
- *"Show me my HRV trend for the past 30 days"*
- *"What was my resting heart rate on Monday?"*
- *"List my last 10 runs with pace and distance"*
- *"How does my training readiness compare to my stress levels this month?"*

Claude fetches the data from Garmin Connect in real time and can reason across multiple metrics in a single response.

---

## Requirements

- **Node.js** 18 or later
- **A Garmin Connect account** with data synced from a compatible device
- **Claude Desktop** (or any MCP-compatible client)

---

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

---

## Authentication

Tokens are stored in `~/.garmin-mcp/`:

| File | Contents |
|---|---|
| `oauth1_token.json` | OAuth 1 token |
| `oauth2_token.json` | OAuth 2 token |

These files are created by `npx gc-mcp login` and read at server startup. If your session expires or you see authentication errors, run `npx gc-mcp login` again and restart Claude Desktop.

---

## Available Tools

### Daily Health

These tools support **single-day and date-range** modes (see [Date Range Support](#date-range-support)).

| Tool | Description | Parameters |
|---|---|---|
| `get_daily_summary` | Steps, calories, floors, active minutes, and distance | `start_date?`, `end_date?` |
| `get_heart_rate` | Resting heart rate and intraday HR curve | `start_date?`, `end_date?` |
| `get_stress` | Average/max stress levels and stress timeline | `start_date?`, `end_date?` |
| `get_body_battery` | Energy charge/drain curve throughout the day | `start_date?`, `end_date?` |
| `get_sleep_data` | Deep/light/REM/awake breakdown, sleep score, SpO2 during sleep | `start_date?`, `end_date?` |
| `get_hrv_status` | Nightly HRV score and 5-night rolling average | `start_date?`, `end_date?` |
| `get_respiration` | Breathing rate throughout the day | `start_date?`, `end_date?` |
| `get_spo2` | Blood oxygen (SpO2) readings | `start_date?`, `end_date?` |
| `get_hydration` | Water intake log | `start_date?`, `end_date?` |

---

### Fitness & Performance

| Tool | Description | Parameters |
|---|---|---|
| `get_training_status` | Fitness level: peaking, productive, maintaining, unproductive, etc. | `start_date?`, `end_date?` |
| `get_training_readiness` | Readiness score with contributing factors (sleep, HRV, recovery) | `start_date?`, `end_date?` |
| `get_training_load` | Acute vs chronic load balance (ACWR) over the 28 days ending on a date | `date?` |
| `get_vo2max` | VO2 max estimate for running and cycling separately | `date?` |
| `get_race_predictor` | Predicted 5K, 10K, half marathon, and marathon times | — |
| `get_personal_records` | All-time personal records across all sport types | — |

---

### Activities

| Tool | Description | Parameters |
|---|---|---|
| `list_activities` | List activities with summary stats | `limit?` (1–100, default 20), `sport_type?`, `start_date?`, `end_date?` |
| `get_activity` | Full details for a single activity | `activity_id` (required) |
| `get_activity_splits` | Lap/split data for a single activity | `activity_id` (required) |

**`sport_type` examples:** `running`, `cycling`, `swimming`, `strength_training`, `hiking`

---

### Body Composition

| Tool | Description | Parameters |
|---|---|---|
| `get_body_composition` | BMI, body fat percentage, and muscle mass | `start_date?`, `end_date?` |
| `get_weight_history` | Weight measurements over a date range (requires Garmin Index scale) | `start_date` (required), `end_date` (required) |

---

### Gear & Profile

| Tool | Description | Parameters |
|---|---|---|
| `list_gear` | Shoes, bikes, and other gear with usage mileage | — |
| `get_user_profile` | Display name, date of birth, weight, and preferred units | — |

---

## Date Range Support

Twelve tools support an optional `end_date` parameter to retrieve multiple days in a single call.

### Modes

| Input | Mode | Response shape |
|---|---|---|
| No parameters | Single day (today) | Object |
| `start_date` only | Single day | Object |
| `start_date` + `end_date` | Range | `Array<{ date: string, data: object }>` |

### Rules

- **Maximum range:** 90 days. Requests over this limit return an error.
- **Date order:** `end_date` must be on or after `start_date`.
- **Date format:** `YYYY-MM-DD` (e.g. `2024-03-15`). Invalid formats are rejected before the request is made.
- **Partial failures:** If individual days fail within a range request (e.g. data not available for that date), those days are silently omitted from the result. The remaining days are returned normally.

### Example range response

```json
[
  { "date": "2024-03-01", "data": { "sleepScore": 82, ... } },
  { "date": "2024-03-02", "data": { "sleepScore": 74, ... } },
  { "date": "2024-03-03", "data": { "sleepScore": 91, ... } }
]
```

---

## Example Conversations

**Check today's stats:**
> *"What were my steps and calories today?"*

**Weekly trend:**
> *"Show me my sleep scores for the past 7 days"*  
> *(Claude calls `get_sleep_data` with `start_date: 2024-03-08, end_date: 2024-03-14`)*

**Training analysis:**
> *"How has my HRV trended over the last 30 days, and does it correlate with my training load?"*  
> *(Claude calls `get_hrv_status` with a 30-day range and `get_training_load` for context)*

**Activity lookup:**
> *"List my last 5 runs with pace"*  
> *(Claude calls `list_activities` with `sport_type: "running", limit: 5`)*

**Gear tracking:**
> *"How many kilometres are on my running shoes?"*  
> *(Claude calls `list_gear`)*

---

## Development

### Project structure

```
src/
  index.ts          # CLI entry point (--login flag or MCP server)
  auth.ts           # Token I/O: login(), loadClient()
  garmin-client.ts  # One fetch* function per tool + range helpers
  tools.ts          # MCP tool registration
  __tests__/
    garmin-client.test.ts
```

### Commands

```bash
npm run build       # Compile TypeScript → dist/
npm run login       # Interactive Garmin login, saves tokens to ~/.garmin-mcp/
npm start           # Start MCP server over stdio (requires prior login)
npm test            # Run unit tests with Vitest
npx tsc --noEmit    # Type-check without emitting files
```

### Adding a new tool

1. Add a `fetch*` function in `src/garmin-client.ts`
2. Register it in `src/tools.ts` following the existing `try/catch` pattern
3. Run `npm run build`

No other registration is needed.

### Smoke-testing a function

```bash
node -e "
  const { fetchUserProfile } = require('./dist/garmin-client');
  fetchUserProfile()
    .then(d => console.log(JSON.stringify(d, null, 2)))
    .catch(console.error);
"
```

---

## Troubleshooting

**"Missing credentials" error on startup**

Run `npx gc-mcp login` to authenticate. The server requires token files in `~/.garmin-mcp/` before it can start.

**Tools not appearing in Claude Desktop**

- Re-run `npx gc-mcp setup` to ensure `claude_desktop_config.json` is configured correctly
- Restart Claude Desktop fully (quit and reopen, not just the window)

**"Tool result is too large" error**

This occurs when a date range returns more data than Claude can process in one response (~1 MB). Use a shorter range, or ask Claude to focus on a specific metric rather than fetching everything at once.

**Authentication expired**

Garmin OAuth tokens expire periodically. Run `npx gc-mcp login` again and restart Claude Desktop.

**Data not available for a date**

Some metrics (HRV, SpO2, body composition) require specific hardware. If a day has no data, it is silently omitted from range results. Single-day requests return an error from the Garmin API.

---

## Privacy

- Your Garmin credentials are used only during `npx gc-mcp login` and are never stored.
- OAuth tokens are stored locally in `~/.garmin-mcp/` on your machine.
- All Garmin API requests are made directly from your machine — no data passes through any intermediary server.

---

## License

MIT
