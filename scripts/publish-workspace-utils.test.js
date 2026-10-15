import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runWithOutput } from './publish-workspace-utils.mjs';

vi.mock('node:child_process', async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, spawnSync: vi.fn(original.spawnSync) };
});

afterEach(() => {
  vi.mocked(spawnSync).mockClear();
  vi.restoreAllMocks();
});

function runNode(source) {
  return runWithOutput(process.execPath, ['-e', source], { shell: false });
}

describe('runWithOutput', () => {
  it('returns and forwards stdout and stderr on exit zero', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    expect(runNode("process.stdout.write('out'); process.stderr.write('err')"))
      .toEqual({ stdout: 'out', stderr: 'err' });
    expect(stdout).toHaveBeenCalledWith('out');
    expect(stderr).toHaveBeenCalledWith('err');
  });

  it('rejects nonzero exits and preserves both diagnostic streams', () => {
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    expect(() => runNode("process.stdout.write('before failure'); process.stderr.write('reason'); process.exit(7)"))
      .toThrow(/failed with exit code 7\n---\nbefore failure\nreason/);
  });

  it('rejects a null status with signal diagnostics on every platform', () => {
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: null, signal: 'SIGTERM', stdout: 'before termination', stderr: 'signal reason',
    });
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    expect(() => runNode('unused'))
      .toThrow(/failed with signal SIGTERM\n---\nbefore termination\nsignal reason/);
  });

  it('rejects an actually terminated child with platform-specific exit diagnostics', () => {
    expect(() => runNode("process.kill(process.pid, 'SIGTERM')"))
      .toThrow(/failed with (signal SIGTERM|exit code [1-9]\d*)/);
  });

  it('rejects an indeterminate status even without a reported signal', () => {
    vi.mocked(spawnSync).mockReturnValueOnce({ status: null, signal: null });
    expect(() => runNode('unused')).toThrow('failed with exit code unknown');
  });

  it('preserves spawn errors rather than reporting success', () => {
    const error = new Error('spawn failed');
    vi.mocked(spawnSync).mockReturnValueOnce({ status: null, signal: null, error });
    expect(() => runNode('unused')).toThrow(error);
  });
});
