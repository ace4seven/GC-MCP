import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// ---------------------------------------------------------------------------
// A1: getCoachDir helper
// ---------------------------------------------------------------------------

export function getCoachDir(): string {
  return process.env.GC_MCP_COACH_DIR
    ?? path.join(os.homedir(), '.gc-mcp', 'coach');
}

function ensureCoachDir(): string {
  const dir = getCoachDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ---------------------------------------------------------------------------
// A2: Profile read/write with deep merge
// ---------------------------------------------------------------------------

export interface Profile {
  schema_version: 1;
  created_at: string;
  updated_at: string;
  athlete: {
    primary_modalities: string[];
    secondary_modalities: string[];
    experience_level: 'beginner' | 'intermediate' | 'advanced';
    weekly_hours_available: number;
    preferred_training_days: string[];
    constraints: string[];
    philosophy: string;
  };
  baselines: {
    resting_hr: number | null;
    hrv_7d_avg: number | null;
    vo2max_running: number | null;
    ftp_watts: number | null;
    weight_kg: number | null;
  };
  voice_preferences: {
    tone: 'direct' | 'warm' | 'neutral';
    verbosity: 'concise' | 'balanced' | 'detailed';
    challenge_level: 'low' | 'moderate' | 'high';
  };
}

function profilePath(): string {
  return path.join(getCoachDir(), 'profile.json');
}

export function readProfile(): Profile | null {
  const p = profilePath();
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8')) as Profile;
}

function deepMerge<T>(base: T, patch: Partial<T>): T {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
    return (patch as unknown) as T;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    const baseVal = (base as Record<string, unknown>)?.[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && baseVal && typeof baseVal === 'object' && !Array.isArray(baseVal)) {
      out[k] = deepMerge(baseVal, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

export function writeProfile(partial: Partial<Profile>): void {
  ensureCoachDir();
  const existing = readProfile();
  const today = new Date().toISOString().slice(0, 10);
  const merged: Profile = existing
    ? deepMerge(existing, { ...partial, updated_at: today } as Partial<Profile>)
    : ({ schema_version: 1, created_at: today, ...partial, updated_at: today } as Profile);
  fs.writeFileSync(profilePath(), JSON.stringify(merged, null, 2));
}

// ---------------------------------------------------------------------------
// A3: Markdown-kind read/write
// ---------------------------------------------------------------------------

export type MarkdownKind = 'goals' | 'current_block' | 'weekly_plan' | 'flags';

const MARKDOWN_FILES: Record<MarkdownKind, string> = {
  goals: 'goals.md',
  current_block: 'current-block.md',
  weekly_plan: 'weekly-plan.md',
  flags: 'flags.md',
};

function markdownPath(kind: MarkdownKind): string {
  return path.join(getCoachDir(), MARKDOWN_FILES[kind]);
}

export function readMarkdown(kind: MarkdownKind): string {
  if (!(kind in MARKDOWN_FILES)) {
    throw new Error(`Kind ${String(kind)} is not a markdown kind`);
  }
  const p = markdownPath(kind);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

export function writeMarkdown(kind: MarkdownKind, content: string): void {
  if (!(kind in MARKDOWN_FILES)) {
    throw new Error(`Kind ${String(kind)} is not a markdown kind`);
  }
  ensureCoachDir();
  fs.writeFileSync(markdownPath(kind), content);
}

// ---------------------------------------------------------------------------
// A4: Daily-log read/append/list
// ---------------------------------------------------------------------------

export interface DailyLogFrontmatter {
  date: string;
  readiness_score: number | null;
  subjective_energy: number | null;
  soreness: string[];
  sleep_quality: string | null;
  session_done: string | null;
  rpe: number | null;
  flags_today: string[];
}

function dailyLogDir(): string {
  return path.join(getCoachDir(), 'daily-log');
}

function dailyLogPath(date: string): string {
  return path.join(dailyLogDir(), `${date}.md`);
}

function renderFrontmatter(fm: DailyLogFrontmatter): string {
  const lines: string[] = ['---'];
  lines.push(`date: ${fm.date}`);
  lines.push(`readiness_score: ${fm.readiness_score ?? 'null'}`);
  lines.push(`subjective_energy: ${fm.subjective_energy ?? 'null'}`);
  lines.push('soreness:');
  for (const s of fm.soreness) lines.push(`  - ${s}`);
  lines.push(`sleep_quality: ${fm.sleep_quality === null ? 'null' : JSON.stringify(fm.sleep_quality)}`);
  lines.push(`session_done: ${fm.session_done === null ? 'null' : JSON.stringify(fm.session_done)}`);
  lines.push(`rpe: ${fm.rpe ?? 'null'}`);
  lines.push('flags_today:');
  for (const f of fm.flags_today) lines.push(`  - ${f}`);
  lines.push('---');
  return lines.join('\n');
}

export function readDailyLog(date?: string): string {
  if (date) {
    const p = dailyLogPath(date);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  }
  const dir = dailyLogDir();
  if (!fs.existsSync(dir)) return '';
  const dates = fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => f.replace(/\.md$/, ''))
    .sort()
    .reverse()
    .slice(0, 7);
  return dates.map(d => fs.readFileSync(dailyLogPath(d), 'utf8')).join('\n\n');
}

export function appendDailyLog(
  date: string,
  payload: { frontmatter?: DailyLogFrontmatter; body: string }
): void {
  ensureCoachDir();
  fs.mkdirSync(dailyLogDir(), { recursive: true });
  const p = dailyLogPath(date);
  const exists = fs.existsSync(p);
  if (!exists) {
    if (!payload.frontmatter) {
      throw new Error(`First write for ${date} requires frontmatter`);
    }
    fs.writeFileSync(p, renderFrontmatter(payload.frontmatter) + '\n\n' + payload.body);
  } else {
    fs.appendFileSync(p, '\n\n' + payload.body);
  }
}

export async function listDailyLogs(): Promise<string[]> {
  const dir = dailyLogDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => f.replace(/\.md$/, ''))
    .sort()
    .reverse();
}

// ---------------------------------------------------------------------------
// A5: readFlags with active-vs-closed filtering
// ---------------------------------------------------------------------------

export function readFlags(opts: { include_closed?: boolean } = {}): string {
  const full = readMarkdown('flags');
  if (opts.include_closed || !full) return full;
  const idx = full.indexOf('## Closed flags');
  return idx === -1 ? full : full.slice(0, idx).trimEnd();
}

// ---------------------------------------------------------------------------
// A6: Weekly review read/list (ISO week)
// ---------------------------------------------------------------------------

export function currentIsoWeek(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr + 'T12:00:00Z') : new Date();
  // Thursday in current week decides the year.
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  target.setUTCDate(target.getUTCDate() - dayNr + 3); // shift to Thursday
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target.getTime() - firstThursday.getTime();
  const week = 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
  const year = target.getUTCFullYear();
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function historyDir(): string {
  return path.join(getCoachDir(), 'history');
}

function reviewPath(weekId: string): string {
  return path.join(historyDir(), `${weekId}-review.md`);
}

export function readReview(weekId?: string): string {
  if (weekId) {
    const p = reviewPath(weekId);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  }
  const ids = listReviews();
  if (ids.length === 0) return '';
  return fs.readFileSync(reviewPath(ids[0]), 'utf8');
}

export function writeReview(weekId: string, content: string): void {
  ensureCoachDir();
  fs.mkdirSync(historyDir(), { recursive: true });
  fs.writeFileSync(reviewPath(weekId), content);
}

export function listReviews(): string[] {
  if (!fs.existsSync(historyDir())) return [];
  return fs.readdirSync(historyDir())
    .filter(f => f.endsWith('-review.md'))
    .map(f => f.replace(/-review\.md$/, ''))
    .sort()
    .reverse();
}
