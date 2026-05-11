# Date-Range Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow every per-day Garmin MCP tool to accept an optional `start_date`/`end_date` pair and return batched results in a single call instead of requiring one call per day.

**Architecture:** Add `datesBetween`, `fetchRange`, and `validateDateRange` helpers to `garmin-client.ts`, update 12 `fetch*` function signatures to accept `startDate?`/`endDate?`, then mirror those signatures in `tools.ts` by replacing the shared `date` Zod schema with a `dateRange` object on all 12 affected tools.

**Tech Stack:** TypeScript 5.4, Vitest (to be added), Zod ~3.24, MCP SDK 1.29, garmin-connect 1.6.2

---

## File Map

| File | Change |
|---|---|
| `package.json` | Add `vitest` dev dep; add `test` script |
| `vitest.config.ts` | Create — minimal Vitest config |
| `src/__tests__/garmin-client.test.ts` | Create — unit tests for helpers |
| `src/garmin-client.ts` | Add 3 helpers; update 12 `fetch*` signatures |
| `src/tools.ts` | Replace `date` schema with `dateRange`; update 12 tool handlers |

---

## Task 1: Add Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/__tests__/garmin-client.test.ts`

- [ ] **Step 1: Install Vitest**

```bash
npm install --save-dev vitest
```

Expected: `vitest` appears in `devDependencies` of `package.json`.

- [ ] **Step 2: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run"
```

Full scripts block after change:
```json
"scripts": {
  "build": "tsc",
  "start": "node dist/index.js",
  "login": "node dist/index.js --login",
  "test": "vitest run"
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 4: Create test file with placeholder**

```typescript
// src/__tests__/garmin-client.test.ts
import { describe, it, expect } from 'vitest';

describe('placeholder', () => {
  it('passes', () => expect(true).toBe(true));
});
```

- [ ] **Step 5: Run tests to confirm setup works**

```bash
npm test
```

Expected: `1 passed`

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/__tests__/garmin-client.test.ts
git commit -m "chore: add Vitest test infrastructure"
```

---

## Task 2: `datesBetween` helper — TDD

**Files:**
- Modify: `src/__tests__/garmin-client.test.ts`
- Modify: `src/garmin-client.ts`

- [ ] **Step 1: Write failing tests**

Replace the placeholder in `src/__tests__/garmin-client.test.ts` with:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { datesBetween } from '../garmin-client';

describe('datesBetween', () => {
  it('returns single-element array when start equals end', () => {
    expect(datesBetween('2024-01-01', '2024-01-01')).toEqual(['2024-01-01']);
  });

  it('returns consecutive dates inclusive', () => {
    expect(datesBetween('2024-01-01', '2024-01-03')).toEqual([
      '2024-01-01',
      '2024-01-02',
      '2024-01-03',
    ]);
  });

  it('handles month boundary correctly', () => {
    expect(datesBetween('2024-01-30', '2024-02-01')).toEqual([
      '2024-01-30',
      '2024-01-31',
      '2024-02-01',
    ]);
  });

  it('returns empty array when end is before start', () => {
    expect(datesBetween('2024-01-05', '2024-01-01')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test
```

Expected: FAIL — `datesBetween` is not exported from `garmin-client`.

- [ ] **Step 3: Implement `datesBetween` in garmin-client.ts**

Add after the `today()` helper (after line 24):

```typescript
export function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + 'T12:00:00Z');
  const last = new Date(end + 'T12:00:00Z');
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}
```

> Note: Uses UTC noon to avoid DST boundary edge cases where midnight can shift to the previous day.

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add src/garmin-client.ts src/__tests__/garmin-client.test.ts
git commit -m "feat: add datesBetween helper with tests"
```

---

## Task 3: `fetchRange` helper — TDD

**Files:**
- Modify: `src/__tests__/garmin-client.test.ts`
- Modify: `src/garmin-client.ts`

- [ ] **Step 1: Add failing tests for `fetchRange`**

Append to `src/__tests__/garmin-client.test.ts`:

```typescript
import { fetchRange } from '../garmin-client';

describe('fetchRange', () => {
  it('calls fetcher for each date and collects results', async () => {
    const fetcher = vi.fn().mockResolvedValue({ score: 42 });
    const result = await fetchRange(fetcher, '2024-01-01', '2024-01-03');
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher).toHaveBeenCalledWith('2024-01-01');
    expect(fetcher).toHaveBeenCalledWith('2024-01-02');
    expect(fetcher).toHaveBeenCalledWith('2024-01-03');
    expect(result).toEqual([
      { date: '2024-01-01', data: { score: 42 } },
      { date: '2024-01-02', data: { score: 42 } },
      { date: '2024-01-03', data: { score: 42 } },
    ]);
  });

  it('silently drops dates where fetcher rejects', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ score: 1 })
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce({ score: 3 });
    const result = await fetchRange(fetcher, '2024-01-01', '2024-01-03');
    expect(result).toEqual([
      { date: '2024-01-01', data: { score: 1 } },
      { date: '2024-01-03', data: { score: 3 } },
    ]);
  });

  it('returns empty array when all fetches fail', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('API error'));
    const result = await fetchRange(fetcher, '2024-01-01', '2024-01-03');
    expect(result).toEqual([]);
  });

  it('processes all 8 dates when range exceeds one batch of 7', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    const result = await fetchRange(fetcher, '2024-01-01', '2024-01-08');
    expect(fetcher).toHaveBeenCalledTimes(8);
    expect(result).toHaveLength(8);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test
```

Expected: FAIL — `fetchRange` is not exported from `garmin-client`.

- [ ] **Step 3: Implement `fetchRange` in garmin-client.ts**

Add immediately after the `datesBetween` function:

```typescript
export async function fetchRange<T>(
  fetcher: (date: string) => Promise<T>,
  start: string,
  end: string
): Promise<Array<{ date: string; data: T }>> {
  const dates = datesBetween(start, end);
  const results: Array<{ date: string; data: T }> = [];

  for (let i = 0; i < dates.length; i += 7) {
    const batch = dates.slice(i, i + 7);
    const settled = await Promise.allSettled(
      batch.map(d => fetcher(d).then(data => ({ date: d, data })))
    );
    for (const r of settled) {
      if (r.status === 'fulfilled') results.push(r.value);
    }
  }
  return results;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/garmin-client.ts src/__tests__/garmin-client.test.ts
git commit -m "feat: add fetchRange helper with sliding-window batching"
```

---

## Task 4: `validateDateRange` helper — TDD

**Files:**
- Modify: `src/__tests__/garmin-client.test.ts`
- Modify: `src/garmin-client.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/__tests__/garmin-client.test.ts`:

```typescript
import { validateDateRange } from '../garmin-client';

describe('validateDateRange', () => {
  it('throws when end_date is before start_date', () => {
    expect(() => validateDateRange('2024-01-10', '2024-01-05')).toThrow(
      'end_date must be on or after start_date'
    );
  });

  it('throws when range exceeds 90 days', () => {
    // 2024-01-01 to 2024-03-31 = 31 + 29 + 31 = 91 days (2024 is a leap year)
    expect(() => validateDateRange('2024-01-01', '2024-03-31')).toThrow(
      'Date range exceeds 90 days'
    );
  });

  it('does not throw for a single-day range', () => {
    expect(() => validateDateRange('2024-06-15', '2024-06-15')).not.toThrow();
  });

  it('does not throw for exactly 90 days', () => {
    // 2024-01-01 to 2024-03-30 = 31 + 29 + 30 = 90 days
    expect(() => validateDateRange('2024-01-01', '2024-03-30')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test
```

Expected: FAIL — `validateDateRange` is not exported.

- [ ] **Step 3: Implement `validateDateRange` in garmin-client.ts**

Add immediately after `fetchRange`:

```typescript
export function validateDateRange(start: string, end: string): void {
  if (end < start) {
    throw new Error('end_date must be on or after start_date');
  }
  const days = datesBetween(start, end).length;
  if (days > 90) {
    throw new Error(`Date range exceeds 90 days (got ${days})`);
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/garmin-client.ts src/__tests__/garmin-client.test.ts
git commit -m "feat: add validateDateRange helper with tests"
```

---

## Task 5: Update the 10 per-day fetch functions in garmin-client.ts

Each function gains an `endDate?` parameter. If `endDate` is provided, `validateDateRange` is called and `fetchRange` fans out the calls. Otherwise behaviour is identical to today.

**Files:**
- Modify: `src/garmin-client.ts`

- [ ] **Step 1: Replace all 10 per-day function bodies**

Replace each function with the version below. The functions are in the `// ── Daily Health ──` and `// ── Fitness & Performance ──` sections.

```typescript
export async function fetchDailySummary(startDate?: string, endDate?: string): Promise<unknown> {
  const single = async (d: string) => {
    const name = await getDisplayName();
    return getClient().get(
      `${GC_API}/usersummary-service/usersummary/daily/${name}`,
      { params: { calendarDate: d } }
    );
  };
  if (endDate) {
    validateDateRange(startDate ?? today(), endDate);
    return fetchRange(single, startDate ?? today(), endDate);
  }
  return single(startDate ?? today());
}

export async function fetchHeartRate(startDate?: string, endDate?: string): Promise<unknown> {
  if (endDate) {
    validateDateRange(startDate ?? today(), endDate);
    return fetchRange(
      d => getClient().getHeartRate(new Date(d)),
      startDate ?? today(), endDate
    );
  }
  return getClient().getHeartRate(new Date(startDate ?? today()));
}

export async function fetchStress(startDate?: string, endDate?: string): Promise<unknown> {
  if (endDate) {
    validateDateRange(startDate ?? today(), endDate);
    return fetchRange(
      d => getClient().get(`${GC_API}/wellness-service/wellness/dailyStress/${d}`),
      startDate ?? today(), endDate
    );
  }
  const d = startDate ?? today();
  return getClient().get(`${GC_API}/wellness-service/wellness/dailyStress/${d}`);
}

export async function fetchSleepData(startDate?: string, endDate?: string): Promise<unknown> {
  if (endDate) {
    validateDateRange(startDate ?? today(), endDate);
    return fetchRange(
      d => getClient().getSleepData(new Date(d)),
      startDate ?? today(), endDate
    );
  }
  return getClient().getSleepData(new Date(startDate ?? today()));
}

export async function fetchHrvStatus(startDate?: string, endDate?: string): Promise<unknown> {
  if (endDate) {
    validateDateRange(startDate ?? today(), endDate);
    return fetchRange(
      d => getClient().get(`${GC_API}/hrv-service/hrv/${d}`),
      startDate ?? today(), endDate
    );
  }
  const d = startDate ?? today();
  return getClient().get(`${GC_API}/hrv-service/hrv/${d}`);
}

export async function fetchRespiration(startDate?: string, endDate?: string): Promise<unknown> {
  if (endDate) {
    validateDateRange(startDate ?? today(), endDate);
    return fetchRange(
      d => getClient().get(`${GC_API}/wellness-service/wellness/daily/respiration/${d}`),
      startDate ?? today(), endDate
    );
  }
  const d = startDate ?? today();
  return getClient().get(`${GC_API}/wellness-service/wellness/daily/respiration/${d}`);
}

export async function fetchSpO2(startDate?: string, endDate?: string): Promise<unknown> {
  if (endDate) {
    validateDateRange(startDate ?? today(), endDate);
    return fetchRange(
      d => getClient().get(`${GC_API}/wellness-service/wellness/daily/spo2/${d}`),
      startDate ?? today(), endDate
    );
  }
  const d = startDate ?? today();
  return getClient().get(`${GC_API}/wellness-service/wellness/daily/spo2/${d}`);
}

export async function fetchHydration(startDate?: string, endDate?: string): Promise<unknown> {
  if (endDate) {
    validateDateRange(startDate ?? today(), endDate);
    return fetchRange(
      d => getClient().get(`${GC_API}/usersummary-service/usersummary/hydration/allData/${d}`),
      startDate ?? today(), endDate
    );
  }
  const d = startDate ?? today();
  return getClient().get(`${GC_API}/usersummary-service/usersummary/hydration/allData/${d}`);
}

export async function fetchTrainingStatus(startDate?: string, endDate?: string): Promise<unknown> {
  if (endDate) {
    validateDateRange(startDate ?? today(), endDate);
    return fetchRange(
      d => getClient().get(`${GC_API}/metrics-service/metrics/trainingstatus/aggregated/${d}`),
      startDate ?? today(), endDate
    );
  }
  const d = startDate ?? today();
  return getClient().get(`${GC_API}/metrics-service/metrics/trainingstatus/aggregated/${d}`);
}

export async function fetchTrainingReadiness(startDate?: string, endDate?: string): Promise<unknown> {
  if (endDate) {
    validateDateRange(startDate ?? today(), endDate);
    return fetchRange(
      d => getClient().get(`${GC_API}/metrics-service/metrics/trainingreadiness/${d}`),
      startDate ?? today(), endDate
    );
  }
  const d = startDate ?? today();
  return getClient().get(`${GC_API}/metrics-service/metrics/trainingreadiness/${d}`);
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: all tests pass (no new tests here — correctness is guaranteed by the helper tests + TypeScript).

- [ ] **Step 4: Commit**

```bash
git add src/garmin-client.ts
git commit -m "feat: add date-range support to 10 per-day fetch functions"
```

---

## Task 6: Update the 2 native-range fetch functions in garmin-client.ts

`fetchBodyBattery` and `fetchBodyComposition` already use endpoints that natively accept `startDate`/`endDate`. No batching needed — just expand the date parameters.

**Files:**
- Modify: `src/garmin-client.ts`

- [ ] **Step 1: Replace the two function bodies**

```typescript
export async function fetchBodyBattery(startDate?: string, endDate?: string): Promise<unknown> {
  const start = startDate ?? today();
  const end = endDate ?? start;
  if (endDate) validateDateRange(start, end);
  return getClient().get(
    `${GC_API}/wellness-service/wellness/bodyBattery/reports/daily`,
    { params: { startDate: start, endDate: end } }
  );
}

export async function fetchBodyComposition(startDate?: string, endDate?: string): Promise<unknown> {
  const start = startDate ?? today();
  const end = endDate ?? start;
  if (endDate) validateDateRange(start, end);
  return getClient().get(
    `${GC_API}/weight-service/weight/dateRange`,
    { params: { startDate: start, endDate: end } }
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/garmin-client.ts
git commit -m "feat: add date-range support to fetchBodyBattery and fetchBodyComposition"
```

---

## Task 7: Update tools.ts — replace date schema on 12 tools

**Files:**
- Modify: `src/tools.ts`

- [ ] **Step 1: Replace the shared `date` const with `dateRange`**

At the top of `src/tools.ts`, replace:

```typescript
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
  .optional()
  .describe('Date in YYYY-MM-DD format, defaults to today');
```

With:

```typescript
const dateRange = {
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .optional()
    .describe('Start date YYYY-MM-DD, defaults to today. Omit end_date for single-day mode'),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .optional()
    .describe('End date YYYY-MM-DD inclusive. Omit for single-day mode. Max 90 days'),
};
```

- [ ] **Step 2: Update all 12 tool registrations**

Apply the following changes. Each tool's `inputSchema` and handler changes identically — `{ date }` → `{ ...dateRange }` and `({ date: d })` → `({ start_date, end_date })` and `gc.fetchXxx(d)` → `gc.fetchXxx(start_date, end_date)`.

Full updated registrations for all 12 tools (keep `@ts-expect-error` on `get_daily_summary` as it was there before):

```typescript
  // @ts-expect-error TS2589 — Zod 3.24 × MCP SDK 1.29 generic instantiation depth
  server.registerTool(
    'get_daily_summary',
    {
      description: 'Steps, calories, floors, active minutes, distance for a date',
      inputSchema: { ...dateRange },
    },
    async ({ start_date, end_date }) => {
      try { return ok(await gc.fetchDailySummary(start_date, end_date)); }
      catch (e) { return err(e, 'DAILY_SUMMARY_ERROR'); }
    }
  );

  server.registerTool(
    'get_heart_rate',
    {
      description: 'Resting heart rate and intraday HR curve for a date',
      inputSchema: { ...dateRange },
    },
    async ({ start_date, end_date }) => {
      try { return ok(await gc.fetchHeartRate(start_date, end_date)); }
      catch (e) { return err(e, 'HEART_RATE_ERROR'); }
    }
  );

  server.registerTool(
    'get_stress',
    {
      description: 'Average/max stress levels and stress timeline for a date',
      inputSchema: { ...dateRange },
    },
    async ({ start_date, end_date }) => {
      try { return ok(await gc.fetchStress(start_date, end_date)); }
      catch (e) { return err(e, 'STRESS_ERROR'); }
    }
  );

  server.registerTool(
    'get_body_battery',
    {
      description: 'Energy charge/drain curve throughout the day',
      inputSchema: { ...dateRange },
    },
    async ({ start_date, end_date }) => {
      try { return ok(await gc.fetchBodyBattery(start_date, end_date)); }
      catch (e) { return err(e, 'BODY_BATTERY_ERROR'); }
    }
  );

  server.registerTool(
    'get_sleep_data',
    {
      description: 'Deep/light/REM/awake breakdown, sleep score, and SpO2 during sleep',
      inputSchema: { ...dateRange },
    },
    async ({ start_date, end_date }) => {
      try { return ok(await gc.fetchSleepData(start_date, end_date)); }
      catch (e) { return err(e, 'SLEEP_ERROR'); }
    }
  );

  server.registerTool(
    'get_hrv_status',
    {
      description: 'Nightly HRV score and 5-night rolling average',
      inputSchema: { ...dateRange },
    },
    async ({ start_date, end_date }) => {
      try { return ok(await gc.fetchHrvStatus(start_date, end_date)); }
      catch (e) { return err(e, 'HRV_ERROR'); }
    }
  );

  server.registerTool(
    'get_respiration',
    {
      description: 'Breathing rate throughout the day',
      inputSchema: { ...dateRange },
    },
    async ({ start_date, end_date }) => {
      try { return ok(await gc.fetchRespiration(start_date, end_date)); }
      catch (e) { return err(e, 'RESPIRATION_ERROR'); }
    }
  );

  server.registerTool(
    'get_spo2',
    {
      description: 'Blood oxygen (SpO2) readings for a date',
      inputSchema: { ...dateRange },
    },
    async ({ start_date, end_date }) => {
      try { return ok(await gc.fetchSpO2(start_date, end_date)); }
      catch (e) { return err(e, 'SPO2_ERROR'); }
    }
  );

  server.registerTool(
    'get_hydration',
    {
      description: 'Water intake log for a date',
      inputSchema: { ...dateRange },
    },
    async ({ start_date, end_date }) => {
      try { return ok(await gc.fetchHydration(start_date, end_date)); }
      catch (e) { return err(e, 'HYDRATION_ERROR'); }
    }
  );

  server.registerTool(
    'get_training_status',
    {
      description: 'Current fitness level: peaking, productive, maintaining, unproductive, etc.',
      inputSchema: { ...dateRange },
    },
    async ({ start_date, end_date }) => {
      try { return ok(await gc.fetchTrainingStatus(start_date, end_date)); }
      catch (e) { return err(e, 'TRAINING_STATUS_ERROR'); }
    }
  );

  server.registerTool(
    'get_training_readiness',
    {
      description: 'Readiness score with contributing factors (sleep, HRV, recovery)',
      inputSchema: { ...dateRange },
    },
    async ({ start_date, end_date }) => {
      try { return ok(await gc.fetchTrainingReadiness(start_date, end_date)); }
      catch (e) { return err(e, 'TRAINING_READINESS_ERROR'); }
    }
  );

  server.registerTool(
    'get_body_composition',
    {
      description: 'BMI, body fat percentage, and muscle mass for a date',
      inputSchema: { ...dateRange },
    },
    async ({ start_date, end_date }) => {
      try { return ok(await gc.fetchBodyComposition(start_date, end_date)); }
      catch (e) { return err(e, 'BODY_COMPOSITION_ERROR'); }
    }
  );
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Build**

```bash
npm run build
```

Expected: `dist/` updated with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/tools.ts
git commit -m "feat: replace date schema with start_date/end_date on 12 MCP tools"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| `start_date`/`end_date` schema replacing `date` | Task 7 |
| Single-day mode when no `end_date` | Tasks 5–6 (if `endDate` is falsy, single-day path runs) |
| Range mode returns `Array<{ date, data }>` | Task 3 (`fetchRange` return type) |
| Max 90 days error | Task 4 (`validateDateRange`) |
| `end_date` < `start_date` error | Task 4 (`validateDateRange`) |
| Invalid date format caught by Zod | Task 7 (regex in `dateRange` schema) |
| `fetchBodyBattery` native range | Task 6 |
| `fetchBodyComposition` native range | Task 6 |
| 10 per-day tools batched via `fetchRange` | Task 5 |
| Concurrent batches of 7 | Task 3 (`fetchRange` implementation) |
| Individual day failures silently dropped | Task 3 (allSettled filter) |
| All failures return `[]` | Task 3 (test covers this) |
| Single-day failures propagate as error | Tasks 5–6 (single-day path lets exception bubble to handler) |
| 12 tools NOT changed left untouched | Tasks 5–7 only touch the 12 listed tools |
