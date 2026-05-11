import { describe, it, expect, vi } from 'vitest';

vi.mock('garmin-connect', () => ({
  GarminConnect: vi.fn().mockImplementation(() => ({
    loadTokenByFile: vi.fn().mockImplementation(() => {
      throw new Error('File not found');
    }),
    exportTokenToFile: vi.fn(),
    login: vi.fn(),
  })),
}));

describe('loadClient', () => {
  it('throws with a helpful message when token loading fails', async () => {
    const { loadClient } = await import('../auth');
    expect(() => loadClient()).toThrow('Session not found');
  });
});
