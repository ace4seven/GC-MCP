import { describe, it, expect, vi } from 'vitest';
import { datesBetween, fetchRange, validateDateRange } from '../garmin-client';

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
