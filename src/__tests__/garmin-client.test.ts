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
