export interface ReadinessInputs {
  readiness_score: number | null;      // 0-100
  sleep_score: number | null;          // 0-100
  hrv_last_night: number | null;       // ms
  hrv_7d_avg: number | null;           // ms
  body_battery_at_wake: number | null; // 0-100
}

export type Driver = 'sleep' | 'hrv' | 'load' | 'stress' | 'ok';
export type Tier = 'go_hard' | 'moderate' | 'easy' | 'rest';
export type HrvStatus = 'balanced' | 'low' | 'unbalanced' | 'poor';
export type SleepStatus = 'good' | 'ok' | 'poor';

export interface ReadinessSynthesis {
  composite_readiness: number;
  primary_driver: Driver;
  hrv_status: HrvStatus;
  sleep_status: SleepStatus;
  body_battery_at_wake: number | null;
  recommendation_tier: Tier;
  reasoning: string[];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function normaliseHrv(last: number | null, avg: number | null): number {
  if (last === null || avg === null || avg === 0) return 80;
  return clamp(80 + 50 * ((last - avg) / avg), 0, 100);
}

function tierFor(composite: number): Tier {
  if (composite >= 80) return 'go_hard';
  if (composite >= 65) return 'moderate';
  if (composite >= 50) return 'easy';
  return 'rest';
}

function hrvStatusFor(last: number | null, avg: number | null): HrvStatus {
  if (last === null || avg === null) return 'unbalanced';
  const pct = (last - avg) / Math.max(avg, 1);
  if (pct >= -0.05) return 'balanced';
  if (pct >= -0.15) return 'low';
  if (pct >= -0.25) return 'unbalanced';
  return 'poor';
}

function sleepStatusFor(score: number | null): SleepStatus {
  if (score === null) return 'ok';
  if (score >= 75) return 'good';
  if (score >= 55) return 'ok';
  return 'poor';
}

export function computeReadinessSynthesis(inputs: ReadinessInputs): ReadinessSynthesis {
  const readiness = inputs.readiness_score ?? 50;
  const sleep = inputs.sleep_score ?? 50;
  const hrvNorm = normaliseHrv(inputs.hrv_last_night, inputs.hrv_7d_avg);
  const bb = inputs.body_battery_at_wake ?? 50;

  const composite = Math.round(
    readiness * 0.4 + sleep * 0.3 + hrvNorm * 0.2 + bb * 0.1
  );

  // Driver: largest negative deviation from a 75 reference baseline (proxy for "good").
  const deviations: Array<{ driver: Driver; pct: number; reason: string }> = [];
  if (inputs.sleep_score !== null) {
    deviations.push({ driver: 'sleep', pct: (sleep - 75) / 75, reason: `Sleep ${sleep}/100` });
  }
  if (inputs.hrv_last_night !== null && inputs.hrv_7d_avg) {
    const pct = (inputs.hrv_last_night - inputs.hrv_7d_avg) / inputs.hrv_7d_avg;
    deviations.push({ driver: 'hrv', pct, reason: `HRV ${(pct * 100).toFixed(0)}% vs 7d avg` });
  }
  if (inputs.body_battery_at_wake !== null) {
    deviations.push({ driver: 'load', pct: (bb - 75) / 75, reason: `Body Battery at wake ${bb}` });
  }
  if (inputs.readiness_score !== null) {
    deviations.push({ driver: 'stress', pct: (readiness - 75) / 75, reason: `Garmin readiness ${readiness}` });
  }

  const worst = deviations.reduce((a, b) => (b.pct < a.pct ? b : a), { driver: 'ok' as Driver, pct: 0, reason: '' });
  const primary_driver: Driver = worst.pct <= -0.10 ? worst.driver : 'ok';

  const reasoning = deviations
    .filter(d => d.pct < 0)
    .sort((a, b) => a.pct - b.pct)
    .map(d => d.reason);

  return {
    composite_readiness: clamp(composite, 0, 100),
    primary_driver,
    hrv_status: hrvStatusFor(inputs.hrv_last_night, inputs.hrv_7d_avg),
    sleep_status: sleepStatusFor(inputs.sleep_score),
    body_battery_at_wake: inputs.body_battery_at_wake,
    recommendation_tier: tierFor(composite),
    reasoning,
  };
}

import {
  fetchTrainingReadiness,
  fetchHrvStatus,
  fetchSleepData,
  fetchBodyBattery,
} from '../garmin-client';

function extractReadinessScore(r: unknown): number | null {
  if (Array.isArray(r) && r.length > 0) {
    const first = r[0] as { score?: number };
    return typeof first.score === 'number' ? first.score : null;
  }
  const o = r as { score?: number } | null;
  return o && typeof o.score === 'number' ? o.score : null;
}

function extractSleepScore(r: unknown): number | null {
  const o = r as { dailySleepDTO?: { sleepScores?: { overall?: { value?: number } } } } | null;
  return o?.dailySleepDTO?.sleepScores?.overall?.value ?? null;
}

function extractHrv(r: unknown): { last: number | null; avg: number | null } {
  const o = r as { hrvSummary?: { lastNightAvg?: number; weeklyAvg?: number } } | null;
  return {
    last: o?.hrvSummary?.lastNightAvg ?? null,
    avg: o?.hrvSummary?.weeklyAvg ?? null,
  };
}

function extractBodyBatteryAtWake(r: unknown): number | null {
  if (!Array.isArray(r) || r.length === 0) return null;
  const first = r[0] as { bodyBatteryValuesArray?: Array<[number, number]> };
  const arr = first.bodyBatteryValuesArray;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[0][1] ?? null;
}

export async function fetchReadinessSynthesis(dateStr?: string): Promise<ReadinessSynthesis> {
  const date = dateStr ?? new Date().toISOString().slice(0, 10);
  const [readiness, hrv, sleep, bb] = await Promise.all([
    fetchTrainingReadiness(date).catch(() => null),
    fetchHrvStatus(date).catch(() => null),
    fetchSleepData(date).catch(() => null),
    fetchBodyBattery(date).catch(() => null),
  ]);

  const hrvParts = extractHrv(hrv);
  return computeReadinessSynthesis({
    readiness_score: extractReadinessScore(readiness),
    sleep_score: extractSleepScore(sleep),
    hrv_last_night: hrvParts.last,
    hrv_7d_avg: hrvParts.avg,
    body_battery_at_wake: extractBodyBatteryAtWake(bb),
  });
}
