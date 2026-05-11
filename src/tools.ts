import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import * as gc from './garmin-client';

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
  .optional()
  .describe('Date in YYYY-MM-DD format, defaults to today');

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

function ok(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

function err(e: unknown, code: string): CallToolResult {
  const msg = e instanceof Error ? e.message : String(e);
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: msg, code }) }],
    isError: true,
  };
}

export function registerAllTools(server: McpServer): void {
  // ── Daily Health ────────────────────────────────────────────────────────────

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

  // ── Fitness & Performance ───────────────────────────────────────────────────

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
    'get_training_load',
    {
      description: 'Acute vs chronic load balance (ACWR) over the 28 days ending on date',
      inputSchema: { date },
    },
    async ({ date: d }) => {
      try { return ok(await gc.fetchTrainingLoad(d)); }
      catch (e) { return err(e, 'TRAINING_LOAD_ERROR'); }
    }
  );

  server.registerTool(
    'get_vo2max',
    {
      description: 'VO2 max estimate for running and cycling separately',
      inputSchema: { date },
    },
    async ({ date: d }) => {
      try { return ok(await gc.fetchVo2Max(d)); }
      catch (e) { return err(e, 'VO2MAX_ERROR'); }
    }
  );

  server.registerTool(
    'get_race_predictor',
    {
      description: 'Predicted 5K, 10K, half marathon, and marathon times',
      inputSchema: {},
    },
    async () => {
      try { return ok(await gc.fetchRacePredictor()); }
      catch (e) { return err(e, 'RACE_PREDICTOR_ERROR'); }
    }
  );

  server.registerTool(
    'get_personal_records',
    {
      description: 'All-time personal records across all sport types',
      inputSchema: {},
    },
    async () => {
      try { return ok(await gc.fetchPersonalRecords()); }
      catch (e) { return err(e, 'PERSONAL_RECORDS_ERROR'); }
    }
  );

  // ── Activities ──────────────────────────────────────────────────────────────

  server.registerTool(
    'list_activities',
    {
      description: 'List activities with summary stats',
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional().describe('Number of activities, 1–100, defaults to 20'),
        sport_type: z.string().optional().describe('Filter by sport type, e.g. "running", "cycling"'),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Start of date range YYYY-MM-DD'),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('End of date range YYYY-MM-DD'),
      },
    },
    async ({ limit, sport_type, start_date, end_date }) => {
      try {
        return ok(await gc.fetchActivities(limit, sport_type, start_date, end_date));
      } catch (e) {
        return err(e, 'LIST_ACTIVITIES_ERROR');
      }
    }
  );

  // @ts-expect-error TS2589 — Zod 3.24 × MCP SDK 1.29 generic instantiation depth
  server.registerTool(
    'get_activity',
    {
      description: 'Full details for a single activity',
      inputSchema: {
        activity_id: z.string().describe('Garmin activity ID (numeric string)'),
      },
    },
    async ({ activity_id }) => {
      try { return ok(await gc.fetchActivity(activity_id)); }
      catch (e) { return err(e, 'GET_ACTIVITY_ERROR'); }
    }
  );

  server.registerTool(
    'get_activity_splits',
    {
      description: 'Lap/split data for a single activity',
      inputSchema: {
        activity_id: z.string().describe('Garmin activity ID (numeric string)'),
      },
    },
    async ({ activity_id }) => {
      try { return ok(await gc.fetchActivitySplits(activity_id)); }
      catch (e) { return err(e, 'ACTIVITY_SPLITS_ERROR'); }
    }
  );

  // ── Body Composition ────────────────────────────────────────────────────────

  server.registerTool(
    'get_weight_history',
    {
      description: 'Weight measurements over a date range (requires Garmin Index scale)',
      inputSchema: {
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Start date YYYY-MM-DD'),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('End date YYYY-MM-DD'),
      },
    },
    async ({ start_date, end_date }) => {
      try { return ok(await gc.fetchWeightHistory(start_date, end_date)); }
      catch (e) { return err(e, 'WEIGHT_HISTORY_ERROR'); }
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

  // ── Gear & Profile ──────────────────────────────────────────────────────────

  server.registerTool(
    'list_gear',
    {
      description: 'Shoes, bikes, and other gear with usage mileage',
      inputSchema: {},
    },
    async () => {
      try { return ok(await gc.fetchGear()); }
      catch (e) { return err(e, 'LIST_GEAR_ERROR'); }
    }
  );

  server.registerTool(
    'get_user_profile',
    {
      description: 'Display name, date of birth, weight, and preferred units',
      inputSchema: {},
    },
    async () => {
      try { return ok(await gc.fetchUserProfile()); }
      catch (e) { return err(e, 'USER_PROFILE_ERROR'); }
    }
  );
}
