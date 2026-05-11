import { GarminConnect } from 'garmin-connect';
import { loadClient } from './auth';

const GC_API = 'https://connectapi.garmin.com';

let _client: GarminConnect | null = null;
let _displayName: string | null = null;

export function getClient(): GarminConnect {
  if (!_client) _client = loadClient();
  return _client;
}

export async function getDisplayName(): Promise<string> {
  if (!_displayName) {
    const profile = await getClient().getUserProfile();
    _displayName = profile.displayName;
  }
  return _displayName;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

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

export function validateDateRange(start: string, end: string): void {
  if (end < start) {
    throw new Error('end_date must be on or after start_date');
  }
  const days = datesBetween(start, end).length;
  if (days > 90) {
    throw new Error(`Date range exceeds 90 days (got ${days})`);
  }
}

// ── Daily Health ──────────────────────────────────────────────────────────────

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

export async function fetchBodyBattery(date?: string): Promise<unknown> {
  const d = date ?? today();
  return getClient().get(
    `${GC_API}/wellness-service/wellness/bodyBattery/reports/daily`,
    { params: { startDate: d, endDate: d } }
  );
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

// ── Fitness & Performance ─────────────────────────────────────────────────────

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

export async function fetchTrainingLoad(date?: string): Promise<unknown> {
  const endDate = date ?? today();
  const start = new Date(endDate);
  start.setDate(start.getDate() - 28);
  const startDate = start.toISOString().slice(0, 10);
  const name = await getDisplayName();
  return getClient().get(
    `${GC_API}/metrics-service/metrics/acwr/${name}`,
    { params: { fromCalendarDate: startDate, toCalendarDate: endDate } }
  );
}

export async function fetchVo2Max(date?: string): Promise<unknown> {
  const d = date ?? today();
  const name = await getDisplayName();
  return getClient().get(
    `${GC_API}/metrics-service/metrics/maxmet/weekly/${name}`,
    { params: { fromDate: d, until: d } }
  );
}

export async function fetchRacePredictor(): Promise<unknown> {
  const name = await getDisplayName();
  return getClient().get(
    `${GC_API}/metrics-service/metrics/racepredictions/latest/${name}`
  );
}

export async function fetchPersonalRecords(): Promise<unknown> {
  const name = await getDisplayName();
  return getClient().get(
    `${GC_API}/personalrecord-service/personalrecord/prs/${name}`
  );
}

// ── Activities ────────────────────────────────────────────────────────────────

export async function fetchActivities(
  limit = 20,
  sportType?: string,
  startDate?: string,
  endDate?: string
): Promise<unknown> {
  return getClient().get(
    `${GC_API}/activitylist-service/activities/search/activities`,
    { params: { start: 0, limit, activityType: sportType, startDate, endDate } }
  );
}

export async function fetchActivity(activityId: string): Promise<unknown> {
  return getClient().getActivity({ activityId: Number(activityId) });
}

export async function fetchActivitySplits(activityId: string): Promise<unknown> {
  return getClient().get(
    `${GC_API}/activity-service/activity/${activityId}/splits`
  );
}

// ── Body Composition ──────────────────────────────────────────────────────────

export async function fetchWeightHistory(
  startDate: string,
  endDate: string
): Promise<unknown> {
  return getClient().get(
    `${GC_API}/weight-service/weight/dateRange`,
    { params: { startDate, endDate } }
  );
}

export async function fetchBodyComposition(date?: string): Promise<unknown> {
  const d = date ?? today();
  return getClient().get(
    `${GC_API}/weight-service/weight/dateRange`,
    { params: { startDate: d, endDate: d } }
  );
}

// ── Gear & Profile ────────────────────────────────────────────────────────────

export async function fetchGear(): Promise<unknown> {
  const profile = await getClient().getUserProfile();
  return getClient().get(
    `${GC_API}/gear-service/gear/userGear`,
    { params: { userProfilePK: profile.profileId } }
  );
}

export async function fetchUserProfile(): Promise<unknown> {
  return getClient().getUserProfile();
}
