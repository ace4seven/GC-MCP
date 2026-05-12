import { describe, it, expect, vi } from 'vitest';
import { computeLoadSummary, ActivityRow } from '../coach/load-summary';

vi.mock('../garmin-client', () => ({
  fetchActivities: vi.fn(),
  fetchTrainingLoad: vi.fn(),
}));

function mkActivity(date: string, sport: string, durationMin: number, load: number): ActivityRow {
  return {
    startTimeLocal: `${date}T08:00:00`,
    activityType: { typeKey: sport },
    duration: durationMin * 60,
    activityTrainingLoad: load,
  };
}

describe('computeLoadSummary', () => {
  const today = '2026-05-12';

  it('classifies optimal ACWR zone (0.8-1.3)', () => {
    const activities: ActivityRow[] = [];
    // 7 days of equal load — acute equals chronic
    for (let i = 0; i < 28; i++) {
      const d = new Date('2026-05-12');
      d.setDate(d.getDate() - i);
      activities.push(mkActivity(d.toISOString().slice(0, 10), 'running', 60, 100));
    }
    const r = computeLoadSummary(activities, null, { referenceDate: today });
    expect(r.acwr_zone).toBe('optimal');
    expect(r.acwr).toBeCloseTo(1, 1);
  });

  it('classifies danger zone when acute much higher than chronic', () => {
    const activities: ActivityRow[] = [];
    // Heavy last 7 days, light prior 21
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      activities.push(mkActivity(d.toISOString().slice(0, 10), 'running', 60, 400));
    }
    for (let i = 7; i < 28; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      activities.push(mkActivity(d.toISOString().slice(0, 10), 'running', 60, 50));
    }
    const r = computeLoadSummary(activities, null, { referenceDate: today });
    expect(r.acwr_zone).toBe('danger');
    expect(r.acwr).toBeGreaterThan(1.5);
  });

  it('classifies detraining zone (<0.8)', () => {
    const activities: ActivityRow[] = [];
    for (let i = 7; i < 28; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      activities.push(mkActivity(d.toISOString().slice(0, 10), 'running', 60, 200));
    }
    const r = computeLoadSummary(activities, null, { referenceDate: today });
    expect(r.acwr_zone).toBe('detraining');
    expect(r.acwr).toBeLessThan(0.8);
  });

  it('detects rising trend when 7d > prior 7d by >15%', () => {
    const activities: ActivityRow[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      activities.push(mkActivity(d.toISOString().slice(0, 10), 'running', 60, 200));
    }
    for (let i = 7; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      activities.push(mkActivity(d.toISOString().slice(0, 10), 'running', 60, 100));
    }
    const r = computeLoadSummary(activities, null, { referenceDate: today });
    expect(r.trend_7d_vs_prev).toBe('rising');
  });

  it('buckets by modality and computes share_of_load', () => {
    const activities: ActivityRow[] = [
      mkActivity(today, 'running', 60, 300),
      mkActivity(today, 'cycling', 60, 100),
    ];
    const r = computeLoadSummary(activities, null, { referenceDate: today });
    expect(r.by_modality.running?.share_of_load).toBeCloseTo(0.75, 2);
    expect(r.by_modality.cycling?.share_of_load).toBeCloseTo(0.25, 2);
  });

  it('emits a note when strength sessions have no Garmin load', () => {
    const a: ActivityRow = {
      startTimeLocal: `${today}T08:00:00`,
      activityType: { typeKey: 'strength_training' },
      duration: 60 * 60,
      activityTrainingLoad: 0,
    };
    const r = computeLoadSummary([a], null, { referenceDate: today });
    expect(r.notes.some(n => /strength/i.test(n))).toBe(true);
    expect(r.by_modality.strength?.sessions).toBe(1);
  });

  it('returns acwr=null when chronic load is 0', () => {
    const r = computeLoadSummary([], null, { referenceDate: today });
    expect(r.acwr).toBeNull();
    expect(r.acwr_zone).toBe('detraining');
  });
});

describe('fetchLoadSummary', () => {
  it('passes activities to the pure function and returns the result', async () => {
    const { fetchActivities, fetchTrainingLoad } = await import('../garmin-client');
    (fetchActivities as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        startTimeLocal: '2026-05-12T08:00:00',
        activityType: { typeKey: 'running' },
        duration: 3600,
        activityTrainingLoad: 200,
      },
    ]);
    (fetchTrainingLoad as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const { fetchLoadSummary } = await import('../coach/load-summary');
    const r = await fetchLoadSummary({ windowDays: 28, referenceDate: '2026-05-12' });
    expect(r.by_modality.running?.sessions).toBe(1);
  });
});
