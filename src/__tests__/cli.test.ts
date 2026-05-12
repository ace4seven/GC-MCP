import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkNodeVersion,
  getExistingDisplayName,
  buildClaudeConfig,
  buildMcpServerConfig,
  findClaudeCodeBin,
  CLIENTS,
} from '../cli';

const { mockExecSync } = vi.hoisted(() => ({ mockExecSync: vi.fn() }));
vi.mock('child_process', () => ({ execSync: mockExecSync }));

const MCP_ENTRY = { command: 'npx', args: ['-y', '@ace4seven/gc-mcp'] };
const ZED_ENTRY = { source: 'custom', ...MCP_ENTRY };

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

describe('buildMcpServerConfig', () => {
  it('creates config with given serverKey when existing is null', () => {
    expect(buildMcpServerConfig(null, 'mcpServers', MCP_ENTRY)).toEqual({
      mcpServers: { garmin: MCP_ENTRY },
    });
  });

  it('uses servers key (VS Code style)', () => {
    expect(buildMcpServerConfig(null, 'servers', MCP_ENTRY)).toEqual({
      servers: { garmin: MCP_ENTRY },
    });
  });

  it('uses context_servers key with Zed entry', () => {
    expect(buildMcpServerConfig(null, 'context_servers', ZED_ENTRY)).toEqual({
      context_servers: { garmin: ZED_ENTRY },
    });
  });

  it('preserves existing top-level keys', () => {
    const existing = { theme: 'dark', mcpServers: { other: { command: 'foo' } } };
    const result = buildMcpServerConfig(existing, 'mcpServers', MCP_ENTRY);
    expect(result.theme).toBe('dark');
    expect(result.mcpServers.garmin).toEqual(MCP_ENTRY);
    expect(result.mcpServers.other).toEqual({ command: 'foo' });
  });

  it('overwrites an existing garmin entry', () => {
    const existing = { mcpServers: { garmin: { command: 'old' } } };
    expect(buildMcpServerConfig(existing, 'mcpServers', MCP_ENTRY).mcpServers.garmin).toEqual(MCP_ENTRY);
  });
});

describe('buildClaudeConfig', () => {
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
    expect(buildClaudeConfig(existing).mcpServers.garmin).toEqual(MCP_ENTRY);
  });

  it('handles an object missing the mcpServers key', () => {
    expect(buildClaudeConfig({ otherKey: true }).mcpServers.garmin).toEqual(MCP_ENTRY);
  });
});

describe('CLIENTS table', () => {
  it('has entries for all expected clients', () => {
    const ids = CLIENTS.map(c => c.id);
    expect(ids).toContain('claude-desktop');
    expect(ids).toContain('cursor');
    expect(ids).toContain('windsurf');
    expect(ids).toContain('vscode');
    expect(ids).toContain('zed');
  });

  it('claude-desktop uses mcpServers key', () => {
    const client = CLIENTS.find(c => c.id === 'claude-desktop')!;
    expect(client.serverKey).toBe('mcpServers');
    expect(client.entry).toEqual(MCP_ENTRY);
  });

  it('vscode uses servers key', () => {
    const client = CLIENTS.find(c => c.id === 'vscode')!;
    expect(client.serverKey).toBe('servers');
    expect(client.entry).toEqual(MCP_ENTRY);
  });

  it('zed uses context_servers key with source:custom', () => {
    const client = CLIENTS.find(c => c.id === 'zed')!;
    expect(client.serverKey).toBe('context_servers');
    expect(client.entry).toEqual(ZED_ENTRY);
  });

  it('cursor and windsurf use mcpServers key', () => {
    const cursor = CLIENTS.find(c => c.id === 'cursor')!;
    const windsurf = CLIENTS.find(c => c.id === 'windsurf')!;
    expect(cursor.serverKey).toBe('mcpServers');
    expect(windsurf.serverKey).toBe('mcpServers');
  });

  it('all clients have configPath, entry, and isInstalled', () => {
    for (const client of CLIENTS) {
      expect(client.configPath).toBeTruthy();
      expect(client.entry).toBeTruthy();
      expect(typeof client.isInstalled).toBe('function');
    }
  });
});

describe('findClaudeCodeBin', () => {
  afterEach(() => {
    mockExecSync.mockReset();
  });

  it('returns trimmed path when claude binary is found', () => {
    mockExecSync.mockReturnValue('/usr/local/bin/claude\n');
    expect(findClaudeCodeBin()).toBe('/usr/local/bin/claude');
  });

  it('returns null when which throws', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('not found');
    });
    expect(findClaudeCodeBin()).toBeNull();
  });
});
