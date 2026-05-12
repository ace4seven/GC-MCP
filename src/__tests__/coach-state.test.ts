import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gc-coach-'));
  process.env.GC_MCP_COACH_DIR = tmp;
  vi.resetModules();
});
afterEach(() => {
  delete process.env.GC_MCP_COACH_DIR;
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('getCoachDir', () => {
  it('respects GC_MCP_COACH_DIR when set', async () => {
    const { getCoachDir } = await import('../coach/state');
    expect(getCoachDir()).toBe(tmp);
  });

  it('defaults to ~/.gc-mcp/coach when env var is absent', async () => {
    delete process.env.GC_MCP_COACH_DIR;
    const { getCoachDir } = await import('../coach/state');
    expect(getCoachDir()).toBe(path.join(os.homedir(), '.gc-mcp', 'coach'));
  });
});

describe('profile read/write', () => {
  it('returns null when profile.json does not exist', async () => {
    const { readProfile } = await import('../coach/state');
    expect(readProfile()).toBeNull();
  });

  it('writes a full profile and reads it back', async () => {
    const { readProfile, writeProfile } = await import('../coach/state');
    writeProfile({
      schema_version: 1,
      created_at: '2026-05-12',
      updated_at: '2026-05-12',
      athlete: {
        primary_modalities: ['running'],
        secondary_modalities: [],
        experience_level: 'intermediate',
        weekly_hours_available: 6,
        preferred_training_days: ['Mon', 'Wed', 'Fri'],
        constraints: [],
        philosophy: 'longevity',
      },
      baselines: {
        resting_hr: 52, hrv_7d_avg: 68,
        vo2max_running: 51, ftp_watts: null, weight_kg: 78,
      },
      voice_preferences: {
        tone: 'direct', verbosity: 'concise', challenge_level: 'high',
      },
    });
    const p = readProfile();
    expect(p?.athlete.primary_modalities).toEqual(['running']);
    expect(p?.baselines.resting_hr).toBe(52);
  });

  it('deep-merges partial writes into existing profile', async () => {
    const { readProfile, writeProfile } = await import('../coach/state');
    writeProfile({
      schema_version: 1,
      created_at: '2026-05-12',
      updated_at: '2026-05-12',
      athlete: {
        primary_modalities: ['running'],
        secondary_modalities: [],
        experience_level: 'intermediate',
        weekly_hours_available: 6,
        preferred_training_days: ['Mon'],
        constraints: [],
        philosophy: '',
      },
      baselines: { resting_hr: 52, hrv_7d_avg: 68, vo2max_running: 51, ftp_watts: null, weight_kg: 78 },
      voice_preferences: { tone: 'direct', verbosity: 'concise', challenge_level: 'high' },
    });
    writeProfile({ baselines: { resting_hr: 50 } });
    const p = readProfile();
    expect(p?.baselines.resting_hr).toBe(50);
    expect(p?.baselines.hrv_7d_avg).toBe(68); // preserved
    expect(p?.athlete.primary_modalities).toEqual(['running']); // preserved
  });

  it('updates updated_at on every write', async () => {
    const { readProfile, writeProfile } = await import('../coach/state');
    writeProfile({
      schema_version: 1,
      created_at: '2026-05-12',
      updated_at: '2026-05-12',
      athlete: { primary_modalities: ['running'], secondary_modalities: [], experience_level: 'intermediate', weekly_hours_available: 6, preferred_training_days: [], constraints: [], philosophy: '' },
      baselines: { resting_hr: null, hrv_7d_avg: null, vo2max_running: null, ftp_watts: null, weight_kg: null },
      voice_preferences: { tone: 'direct', verbosity: 'concise', challenge_level: 'high' },
    });
    writeProfile({ athlete: { weekly_hours_available: 8 } });
    const today = new Date().toISOString().slice(0, 10);
    expect(readProfile()?.updated_at).toBe(today);
  });
});

describe('markdown kind read/write', () => {
  it('returns empty string when goals.md is missing', async () => {
    const { readMarkdown } = await import('../coach/state');
    expect(readMarkdown('goals')).toBe('');
  });

  it('writes and reads goals.md', async () => {
    const { writeMarkdown, readMarkdown } = await import('../coach/state');
    writeMarkdown('goals', 'Finish a sub-3 marathon by autumn 2026.');
    expect(readMarkdown('goals')).toBe('Finish a sub-3 marathon by autumn 2026.');
  });

  it('writes current_block.md to current-block.md (slug normalisation)', async () => {
    const { writeMarkdown, readMarkdown } = await import('../coach/state');
    writeMarkdown('current_block', '# Block 1\n4 weeks, base.');
    expect(readMarkdown('current_block')).toBe('# Block 1\n4 weeks, base.');
    // direct file check
    const dir = process.env.GC_MCP_COACH_DIR!;
    expect(fs.existsSync(path.join(dir, 'current-block.md'))).toBe(true);
  });

  it('rejects daily_log via markdown helpers (must use daily-log helpers)', async () => {
    const { writeMarkdown } = await import('../coach/state');
    expect(() => writeMarkdown('daily_log' as any, 'x')).toThrow(/daily_log/);
  });
});

describe('daily log', () => {
  it('returns empty string when day is missing', async () => {
    const { readDailyLog } = await import('../coach/state');
    expect(readDailyLog('2026-05-12')).toBe('');
  });

  it('appendDailyLog creates the file with frontmatter on first call', async () => {
    const { appendDailyLog, readDailyLog } = await import('../coach/state');
    appendDailyLog('2026-05-12', {
      frontmatter: {
        date: '2026-05-12', readiness_score: 78, subjective_energy: 7,
        soreness: ['calves'], sleep_quality: 'ok', session_done: 'easy 8k',
        rpe: 4, flags_today: [],
      },
      body: '## Coach notes\nCalves likely from yesterday.',
    });
    const out = readDailyLog('2026-05-12');
    expect(out).toContain('date: 2026-05-12');
    expect(out).toContain('readiness_score: 78');
    expect(out).toContain('soreness:');
    expect(out).toContain('  - calves');
    expect(out).toContain('## Coach notes');
  });

  it('appendDailyLog appends additional body without rewriting frontmatter', async () => {
    const { appendDailyLog, readDailyLog } = await import('../coach/state');
    appendDailyLog('2026-05-12', {
      frontmatter: { date: '2026-05-12', readiness_score: 78, subjective_energy: null, soreness: [], sleep_quality: null, session_done: null, rpe: null, flags_today: [] },
      body: '## Coach notes\nFirst note.',
    });
    appendDailyLog('2026-05-12', { body: '\n## Coach notes\nSecond note.' });
    const out = readDailyLog('2026-05-12');
    expect(out.match(/## Coach notes/g)?.length).toBe(2);
    expect(out).toContain('First note.');
    expect(out).toContain('Second note.');
    // frontmatter still appears exactly once
    expect(out.match(/^---/gm)?.length).toBe(2); // open + close
  });

  it('readDailyLog with no date returns last 7 available days concatenated newest first', async () => {
    const { appendDailyLog, readDailyLog } = await import('../coach/state');
    for (const d of ['2026-05-01', '2026-05-05', '2026-05-09', '2026-05-12']) {
      appendDailyLog(d, {
        frontmatter: { date: d, readiness_score: null, subjective_energy: null, soreness: [], sleep_quality: null, session_done: null, rpe: null, flags_today: [] },
        body: `## Coach notes\nday ${d}`,
      });
    }
    const out = readDailyLog();
    expect(out.indexOf('day 2026-05-12')).toBeLessThan(out.indexOf('day 2026-05-09'));
    expect(out.indexOf('day 2026-05-09')).toBeLessThan(out.indexOf('day 2026-05-05'));
    expect(out).toContain('day 2026-05-01');
  });

  it('listDailyLogs returns dates newest-first', async () => {
    const { appendDailyLog, listDailyLogs } = await import('../coach/state');
    for (const d of ['2026-05-01', '2026-05-12', '2026-05-05']) {
      appendDailyLog(d, {
        frontmatter: { date: d, readiness_score: null, subjective_energy: null, soreness: [], sleep_quality: null, session_done: null, rpe: null, flags_today: [] },
        body: '## Coach notes\nx',
      });
    }
    expect(await listDailyLogs()).toEqual(['2026-05-12', '2026-05-05', '2026-05-01']);
  });
});

describe('flags filtering', () => {
  it('returns full text when include_closed=true', async () => {
    const { writeMarkdown, readFlags } = await import('../coach/state');
    writeMarkdown('flags',
      '- **active-a** (opened 2026-05-01, watching 14d):\n  Foo.\n\n## Closed flags\n- **old-b** (opened 2026-04-01, closed 2026-04-20):\n  Bar.\n');
    expect(readFlags({ include_closed: true })).toContain('active-a');
    expect(readFlags({ include_closed: true })).toContain('old-b');
  });

  it('strips the closed section by default', async () => {
    const { writeMarkdown, readFlags } = await import('../coach/state');
    writeMarkdown('flags',
      '- **active-a** (opened 2026-05-01, watching 14d):\n  Foo.\n\n## Closed flags\n- **old-b** (opened 2026-04-01, closed 2026-04-20):\n  Bar.\n');
    const out = readFlags();
    expect(out).toContain('active-a');
    expect(out).not.toContain('old-b');
    expect(out).not.toContain('## Closed flags');
  });

  it('returns empty string when flags.md is missing', async () => {
    const { readFlags } = await import('../coach/state');
    expect(readFlags()).toBe('');
  });
});

describe('ISO week + reviews', () => {
  it('currentIsoWeek formats correctly for known dates', async () => {
    const { currentIsoWeek } = await import('../coach/state');
    expect(currentIsoWeek('2026-01-05')).toBe('2026-W02'); // Mon of W2
    expect(currentIsoWeek('2026-05-12')).toBe('2026-W20');
    expect(currentIsoWeek('2025-12-29')).toBe('2026-W01'); // ISO week 1 spans year boundary
  });

  it('writes a review and reads it back by weekId', async () => {
    const { writeReview, readReview } = await import('../coach/state');
    writeReview('2026-W20', '# Week 20\nAdherence 6/7.');
    expect(readReview('2026-W20')).toBe('# Week 20\nAdherence 6/7.');
  });

  it('readReview() with no arg returns the lexicographically latest review', async () => {
    const { writeReview, readReview } = await import('../coach/state');
    writeReview('2026-W18', '# 18');
    writeReview('2026-W20', '# 20');
    writeReview('2026-W19', '# 19');
    expect(readReview()).toBe('# 20');
  });

  it('listReviews returns weekIds newest-first', async () => {
    const { writeReview, listReviews } = await import('../coach/state');
    writeReview('2026-W18', 'x');
    writeReview('2026-W20', 'x');
    writeReview('2026-W19', 'x');
    expect(listReviews()).toEqual(['2026-W20', '2026-W19', '2026-W18']);
  });
});
