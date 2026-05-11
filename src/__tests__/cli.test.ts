import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('cli dispatch', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls startServer when no subcommand is given', async () => {
    vi.spyOn(process, 'argv', 'get').mockReturnValue(['node', 'cli.js']);
    const indexMod = { startServer: vi.fn().mockResolvedValue(undefined) };
    vi.doMock('../index', () => indexMod);

    await import('../cli');

    expect(indexMod.startServer).toHaveBeenCalledOnce();
  });
});
