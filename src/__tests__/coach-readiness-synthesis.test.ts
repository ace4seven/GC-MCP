import { describe, it, expect, vi } from 'vitest';
import { computeReadinessSynthesis, ReadinessInputs } from '../coach/readiness-synthesis';

vi.mock('../garmin-client', () => ({
  fetchTrainingReadiness: vi.fn(),
  fetchHrvStatus: vi.fn(),
  fetchSleepData: vi.fn(),
  fetchBodyBattery: vi.fn(),
}));

function defaults(): ReadinessInputs {
  return {
    readiness_score: 80,
    sleep_score: 80,
    hrv_last_night: 70,
    hrv_7d_avg: 70,
    body_battery_at_wake: 80,
  };
}

describe('computeReadinessSynthesis', () => {
  it('returns go_hard tier when composite ≥ 80', () => {
    const r = computeReadinessSynthesis(defaults());
    expect(r.composite_readiness).toBeGreaterThanOrEqual(80);
    expect(r.recommendation_tier).toBe('go_hard');
  });

  it('returns moderate tier for composite 65-79', () => {
    const r = computeReadinessSynthesis({ ...defaults(), readiness_score: 70, sleep_score: 70 });
    expect(r.composite_readiness).toBeGreaterThanOrEqual(65);
    expect(r.composite_readiness).toBeLessThan(80);
    expect(r.recommendation_tier).toBe('moderate');
  });

  it('returns easy tier for composite 50-64', () => {
    const r = computeReadinessSynthesis({ ...defaults(), readiness_score: 55, sleep_score: 55, body_battery_at_wake: 55 });
    expect(r.recommendation_tier).toBe('easy');
  });

  it('returns rest tier for composite < 50', () => {
    const r = computeReadinessSynthesis({ readiness_score: 30, sleep_score: 30, hrv_last_night: 40, hrv_7d_avg: 70, body_battery_at_wake: 20 });
    expect(r.recommendation_tier).toBe('rest');
  });

  it('flags sleep as primary_driver when sleep score is most depressed', () => {
    const r = computeReadinessSynthesis({ readiness_score: 75, sleep_score: 45, hrv_last_night: 70, hrv_7d_avg: 70, body_battery_at_wake: 75 });
    expect(r.primary_driver).toBe('sleep');
  });

  it('flags hrv when last night is >10% below 7d avg', () => {
    const r = computeReadinessSynthesis({ readiness_score: 78, sleep_score: 78, hrv_last_night: 55, hrv_7d_avg: 70, body_battery_at_wake: 78 });
    expect(r.primary_driver).toBe('hrv');
  });

  it('returns ok driver when no component is ≥10% below norm', () => {
    const r = computeReadinessSynthesis({ readiness_score: 75, sleep_score: 78, hrv_last_night: 68, hrv_7d_avg: 70, body_battery_at_wake: 75 });
    expect(r.primary_driver).toBe('ok');
  });

  it('handles null body battery without crashing', () => {
    const r = computeReadinessSynthesis({ ...defaults(), body_battery_at_wake: null });
    expect(r.body_battery_at_wake).toBeNull();
    expect(r.recommendation_tier).toBeDefined();
  });

  it('includes human-readable reasoning entries', () => {
    const r = computeReadinessSynthesis({ readiness_score: 78, sleep_score: 50, hrv_last_night: 68, hrv_7d_avg: 70, body_battery_at_wake: 78 });
    expect(r.reasoning.some(s => /sleep/i.test(s))).toBe(true);
  });
});

describe('fetchReadinessSynthesis', () => {
  it('normalises Garmin responses and produces a synthesis', async () => {
    const gc = await import('../garmin-client');
    (gc.fetchTrainingReadiness as ReturnType<typeof vi.fn>).mockResolvedValue([{ score: 78 }]);
    (gc.fetchHrvStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ hrvSummary: { lastNightAvg: 68, weeklyAvg: 70 } });
    (gc.fetchSleepData as ReturnType<typeof vi.fn>).mockResolvedValue({ dailySleepDTO: { sleepScores: { overall: { value: 75 } } } });
    (gc.fetchBodyBattery as ReturnType<typeof vi.fn>).mockResolvedValue([{ bodyBatteryValuesArray: [[0, 80]] }]);
    const { fetchReadinessSynthesis } = await import('../coach/readiness-synthesis');
    const r = await fetchReadinessSynthesis('2026-05-12');
    expect(r.composite_readiness).toBeGreaterThan(60);
    expect(r.body_battery_at_wake).toBe(80);
  });

  it('tolerates missing Garmin responses by passing nulls to the pure function', async () => {
    const gc = await import('../garmin-client');
    (gc.fetchTrainingReadiness as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (gc.fetchHrvStatus as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (gc.fetchSleepData as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (gc.fetchBodyBattery as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const { fetchReadinessSynthesis } = await import('../coach/readiness-synthesis');
    const r = await fetchReadinessSynthesis('2026-05-12');
    expect(r.body_battery_at_wake).toBeNull();
    expect(r.composite_readiness).toBeGreaterThanOrEqual(0);
  });
});
