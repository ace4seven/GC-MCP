# Design: Date-Range Support for Garmin MCP Tools

**Date:** 2026-05-11  
**Status:** Approved

## Problem

Most MCP tools only fetch data for a single day. Retrieving 30- or 60-day trends requires the AI to make 30–60 sequential tool calls, which is slow and impractical.

## Goal

Allow every per-day tool to accept an optional date range, returning batched results in one call.

---

## Schema Change

**Before:**
```typescript
{ date?: string }  // YYYY-MM-DD, defaults to today
```

**After:**
```typescript
{
  start_date?: string,  // YYYY-MM-DD, defaults to today
  end_date?: string,    // YYYY-MM-DD, omit for single-day mode
}
```

### Behaviour rules

| Input | Mode | Output shape |
|---|---|---|
| No args | Single day (today) | Object (same as before) |
| `start_date` only | Single day | Object |
| `start_date` + `end_date` | Range | `Array<{ date: string, data: unknown }>` |

- Max range: **90 days** — requests over this limit return an immediate error.
- `end_date` < `start_date` → immediate error.
- Invalid date format → caught by Zod schema before the handler runs.

---

## Tools Affected (12 tools — schema updated)

| Tool | Endpoint type |
|---|---|
| `get_daily_summary` | per-day (batched) |
| `get_heart_rate` | per-day (batched) |
| `get_stress` | per-day (batched) |
| `get_body_battery` | native range (expand dates directly) |
| `get_sleep_data` | per-day (batched) |
| `get_hrv_status` | per-day (batched) |
| `get_respiration` | per-day (batched) |
| `get_spo2` | per-day (batched) |
| `get_hydration` | per-day (batched) |
| `get_training_status` | per-day (batched) |
| `get_training_readiness` | per-day (batched) |
| `get_body_composition` | native range (expand dates directly) |

## Tools NOT Changed (already support ranges or dateless)

`list_activities`, `get_weight_history`, `get_training_load`, `get_vo2max`, `get_race_predictor`, `get_personal_records`, `get_activity`, `get_activity_splits`, `list_gear`, `get_user_profile`

---

## Implementation

### New helpers in `garmin-client.ts`

```typescript
// Returns all YYYY-MM-DD strings from start to end inclusive
function datesBetween(start: string, end: string): string[]

// Fetches one metric for each date, 7 concurrent, drops failures silently
async function fetchRange<T>(
  fetcher: (date: string) => Promise<T>,
  start: string,
  end: string
): Promise<Array<{ date: string; data: T }>>
```

`fetchRange` uses `Promise.allSettled` in sliding batches of 7 to limit concurrent requests and respect Garmin's API.

### Native range endpoints (no batching needed)

- **`get_body_battery`** — `/wellness-service/wellness/bodyBattery/reports/daily` already accepts `startDate`/`endDate`. Expand the dates directly.
- **`get_body_composition`** — `/weight-service/weight/dateRange` already accepts `startDate`/`endDate`. Expand the dates directly.

### Function signature pattern

```typescript
export async function fetchSleepData(
  startDate?: string,
  endDate?: string
): Promise<unknown> {
  if (endDate) {
    return fetchRange(d => singleDaySleepFetch(d), startDate ?? today(), endDate);
  }
  return singleDaySleepFetch(startDate ?? today());
}
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| `end_date` < `start_date` | Immediate error returned to LLM |
| Range > 90 days | Immediate error with clear message |
| Individual day fails in batch | That day is silently dropped |
| All days fail in batch | Returns empty array `[]` (not an error) |
| Single-day mode fails | Error propagates as `{ error, code }` (unchanged) |

---

## File Changes

1. **`src/garmin-client.ts`** — add `datesBetween`, `fetchRange` helpers; update 12 `fetch*` function signatures
2. **`src/tools.ts`** — replace `date` schema with `start_date`/`end_date` on 12 tools; update handler call signatures
