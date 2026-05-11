import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkNodeVersion, getExistingDisplayName, buildClaudeConfig } from '../cli';

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

describe('checkNodeVersion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exits with brew install message when Node < 18', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    checkNodeVersion('v16.14.0');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('brew install node'));
    exitSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('does not exit for Node 18', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    checkNodeVersion('v18.0.0');
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it('does not exit for Node 22', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    checkNodeVersion('v22.3.0');
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });
});

describe('getExistingDisplayName', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when not logged in', async () => {
    vi.doMock('../index', () => ({ startServer: vi.fn().mockResolvedValue(undefined) }));
    vi.doMock('../auth', () => ({
      login: vi.fn(),
      isLoggedIn: vi.fn().mockReturnValue(false),
      loadClient: vi.fn(),
      TOKEN_DIR: '/tmp/.garmin-mcp',
    }));
    vi.resetModules();
    const { getExistingDisplayName } = await import('../cli');
    const result = await getExistingDisplayName();
    expect(result).toBeNull();
  });

  it('returns null when getDisplayName throws', async () => {
    vi.doMock('../index', () => ({ startServer: vi.fn().mockResolvedValue(undefined) }));
    vi.doMock('../auth', () => ({
      login: vi.fn(),
      isLoggedIn: vi.fn().mockReturnValue(true),
      loadClient: vi.fn(),
      TOKEN_DIR: '/tmp/.garmin-mcp',
    }));
    vi.doMock('../garmin-client', () => ({
      getDisplayName: vi.fn().mockRejectedValue(new Error('network error')),
    }));
    vi.resetModules();
    const { getExistingDisplayName } = await import('../cli');
    const result = await getExistingDisplayName();
    expect(result).toBeNull();
  });
});

describe('buildClaudeConfig', () => {
  const MCP_ENTRY = { command: 'npx', args: ['-y', 'gc-mcp'] };

  it('creates minimal config when existing is null', () => {
    expect(buildClaudeConfig(null)).toEqual({
      mcpServers: { garmin: MCP_ENTRY },
    });
  });

  it('merges garmin into existing mcpServers without touching other keys', () => {
    const existing = {
      mcpServers: { other: { command: 'node', args: ['other.js'] } },
    };
    const result = buildClaudeConfig(existing);
    expect(result.mcpServers.garmin).toEqual(MCP_ENTRY);
    expect(result.mcpServers.other).toEqual({ command: 'node', args: ['other.js'] });
  });

  it('overwrites an existing garmin entry', () => {
    const existing = { mcpServers: { garmin: { command: 'node', args: ['old.js'] } } };
    const result = buildClaudeConfig(existing);
    expect(result.mcpServers.garmin).toEqual(MCP_ENTRY);
  });

  it('handles an object missing the mcpServers key', () => {
    const result = buildClaudeConfig({ otherKey: true });
    expect(result.mcpServers.garmin).toEqual(MCP_ENTRY);
  });
});
