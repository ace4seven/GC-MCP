export interface ActivityRow {
  startTimeLocal: string;        // "2026-05-12T08:00:00"
  activityType: { typeKey: string };
  duration: number;              // seconds
  activityTrainingLoad?: number; // Garmin training load; 0 or undefined for non-supported modalities
}

export type ModalityKey = 'running' | 'cycling' | 'strength' | 'other';

export type AcwrZone = 'detraining' | 'optimal' | 'high' | 'danger';

export interface ModalityBucket {
  sessions: number;
  hours: number;
  share_of_load: number;
}

export interface LoadSummary {
  acute_load_7d: number;
  chronic_load_28d: number;
  acwr: number | null;
  acwr_zone: AcwrZone;
  trend_7d_vs_prev: 'rising' | 'stable' | 'falling';
  trend_28d_slope: number;
  by_modality: Partial<Record<ModalityKey, ModalityBucket>>;
  notes: string[];
}

const RUNNING = new Set(['running', 'trail_running', 'treadmill_running', 'indoor_running']);
const CYCLING = new Set(['cycling', 'road_biking', 'mountain_biking', 'indoor_cycling', 'gravel_cycling', 'virtual_ride']);
const STRENGTH = new Set(['strength_training', 'indoor_cardio', 'crossfit']);

function modalityOf(typeKey: string): ModalityKey {
  if (RUNNING.has(typeKey)) return 'running';
  if (CYCLING.has(typeKey)) return 'cycling';
  if (STRENGTH.has(typeKey)) return 'strength';
  return 'other';
}

function daysAgo(reference: Date, dateStr: string): number {
  const d = new Date(dateStr);
  const ms = reference.getTime() - d.getTime();
  return Math.floor(ms / (24 * 3600 * 1000));
}

function classifyAcwr(acwr: number | null): AcwrZone {
  if (acwr === null || acwr < 0.8) return 'detraining';
  if (acwr <= 1.3) return 'optimal';
  if (acwr <= 1.5) return 'high';
  return 'danger';
}

export function computeLoadSummary(
  activities: ActivityRow[],
  _loadData: unknown,
  opts: { referenceDate: string }
): LoadSummary {
  const ref = new Date(opts.referenceDate + 'T23:59:59Z');

  let acute = 0;
  let chronic = 0;
  let prevAcute = 0;
  const byMod: Record<ModalityKey, { sessions: number; hours: number; load: number }> = {
    running: { sessions: 0, hours: 0, load: 0 },
    cycling: { sessions: 0, hours: 0, load: 0 },
    strength: { sessions: 0, hours: 0, load: 0 },
    other: { sessions: 0, hours: 0, load: 0 },
  };
  let strengthSeenWithoutLoad = false;

  for (const a of activities) {
    const dateStr = a.startTimeLocal.slice(0, 10);
    const age = daysAgo(ref, dateStr);
    if (age < 0 || age >= 28) continue;
    const mod = modalityOf(a.activityType.typeKey);
    const load = a.activityTrainingLoad ?? 0;
    const hours = a.duration / 3600;

    byMod[mod].sessions += 1;
    byMod[mod].hours += hours;
    byMod[mod].load += load;

    if (age < 7) acute += load;
    chronic += load;
    if (age >= 7 && age < 14) prevAcute += load;

    if (mod === 'strength' && load === 0) strengthSeenWithoutLoad = true;
  }

  const chronicAvg7 = chronic / 4; // 28d / 4 = average 7d
  const acwr = chronicAvg7 > 0 ? acute / chronicAvg7 : null;
  const zone = classifyAcwr(acwr);

  let trend: LoadSummary['trend_7d_vs_prev'] = 'stable';
  if (prevAcute > 0) {
    const change = (acute - prevAcute) / prevAcute;
    if (change > 0.15) trend = 'rising';
    else if (change < -0.15) trend = 'falling';
  } else if (acute > 0) {
    trend = 'rising';
  }

  const slope = chronic > 0 ? (acute - prevAcute) / 7 : 0;

  const totalLoad = byMod.running.load + byMod.cycling.load + byMod.strength.load + byMod.other.load;
  const by_modality: LoadSummary['by_modality'] = {};
  for (const key of ['running', 'cycling', 'strength', 'other'] as ModalityKey[]) {
    const b = byMod[key];
    if (b.sessions > 0) {
      by_modality[key] = {
        sessions: b.sessions,
        hours: Math.round(b.hours * 10) / 10,
        share_of_load: totalLoad > 0 ? b.load / totalLoad : 0,
      };
    }
  }

  const notes: string[] = [];
  if (strengthSeenWithoutLoad) {
    notes.push('Strength sessions detected without Garmin training load — load contribution estimated from session count only.');
  }

  return {
    acute_load_7d: Math.round(acute),
    chronic_load_28d: Math.round(chronic),
    acwr: acwr === null ? null : Math.round(acwr * 100) / 100,
    acwr_zone: zone,
    trend_7d_vs_prev: trend,
    trend_28d_slope: Math.round(slope * 100) / 100,
    by_modality,
    notes,
  };
}

import { fetchActivities, fetchTrainingLoad } from '../garmin-client';

export async function fetchLoadSummary(opts: {
  windowDays?: number;
  referenceDate?: string;
}): Promise<LoadSummary> {
  const reference = opts.referenceDate ?? new Date().toISOString().slice(0, 10);
  const window = opts.windowDays ?? 28;
  const start = new Date(reference);
  start.setDate(start.getDate() - window);
  const startStr = start.toISOString().slice(0, 10);

  const [acts, loadData] = await Promise.all([
    fetchActivities(100, undefined, startStr, reference),
    fetchTrainingLoad(reference).catch(() => null),
  ]);

  const activitiesArr = (Array.isArray(acts) ? acts : []) as ActivityRow[];
  return computeLoadSummary(activitiesArr, loadData, { referenceDate: reference });
}
