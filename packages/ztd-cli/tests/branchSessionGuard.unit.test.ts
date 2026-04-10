import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';

const {
  SESSION_GIT_PATH,
  checkBranchExpectation,
  clearExpectedBranch,
  parseCliArgs,
  recordExpectedBranch,
  resolveSessionFilePath,
} = require('../../../scripts/branch-session-guard.js') as {
  SESSION_GIT_PATH: string;
  checkBranchExpectation(
    cwd?: string,
    helpers?: {
      runGit?: (args: string[], cwd?: string) => string;
      sessionFilePath?: string;
      currentBranch?: string;
      expectedBranch?: string | null;
      readFile?: (filePath: string, encoding: string) => string;
      exists?: (filePath: string) => boolean;
    },
  ): { ok: boolean; code: string; message: string; sessionFilePath: string };
  clearExpectedBranch(
    cwd?: string,
    helpers?: {
      runGit?: (args: string[], cwd?: string) => string;
      sessionFilePath?: string;
      exists?: (filePath: string) => boolean;
      unlink?: (filePath: string) => void;
    },
  ): string;
  parseCliArgs(argv: string[]): { command: string; options: Record<string, unknown> };
  recordExpectedBranch(
    expectedBranch: string,
    cwd?: string,
    helpers?: {
      runGit?: (args: string[], cwd?: string) => string;
      sessionFilePath?: string;
      currentBranch?: string;
    },
  ): { expectedBranch: string; sessionFilePath: string };
  resolveSessionFilePath(cwd?: string, runGit?: (args: string[], cwd?: string) => string): string;
};

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop();
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

function createTempDir(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'branch-session-guard-'));
  tempDirs.push(directory);
  return directory;
}

function gitPathRunner(gitPath: string, currentBranch = 'codex/749-branch-session-guard') {
  return (args: string[]) => {
    if (args[0] === 'rev-parse') {
      return gitPath;
    }
    if (args[0] === 'branch') {
      return currentBranch;
    }
    throw new Error(`Unexpected git args: ${args.join(' ')}`);
  };
}

test('parseCliArgs keeps branch arguments explicit', () => {
  expect(parseCliArgs(['expect', '--branch', 'codex/749-branch-session-guard'])).toEqual({
    command: 'expect',
    options: { branch: 'codex/749-branch-session-guard' },
  });
});

test('resolveSessionFilePath uses git-owned metadata path', () => {
  const cwd = createTempDir();
  const resolved = resolveSessionFilePath(cwd, gitPathRunner('.git/worktrees/redo/rawsql/expected-branch'));

  expect(resolved).toBe(path.resolve(cwd, '.git/worktrees/redo/rawsql/expected-branch'));
  expect(SESSION_GIT_PATH).toBe('rawsql/expected-branch');
});

test('recordExpectedBranch writes the expected branch to the session file', () => {
  const cwd = createTempDir();
  const sessionFilePath = path.join(cwd, '.git', 'rawsql', 'expected-branch');

  const result = recordExpectedBranch('codex/749-branch-session-guard', cwd, {
    runGit: gitPathRunner('.git/rawsql/expected-branch'),
    sessionFilePath,
    currentBranch: 'codex/749-branch-session-guard',
  });

  expect(result.expectedBranch).toBe('codex/749-branch-session-guard');
  expect(readFileSync(sessionFilePath, 'utf8')).toBe('codex/749-branch-session-guard\n');
});

test('checkBranchExpectation fails when no expected branch is recorded', () => {
  const cwd = createTempDir();
  const sessionFilePath = path.join(cwd, '.git', 'rawsql', 'expected-branch');

  const result = checkBranchExpectation(cwd, {
    runGit: gitPathRunner('.git/rawsql/expected-branch'),
    sessionFilePath,
    currentBranch: 'codex/749-branch-session-guard',
  });

  expect(result.ok).toBe(false);
  expect(result.code).toBe('missing-expected-branch');
  expect(result.message).toContain('No expected branch is recorded');
});

test('checkBranchExpectation passes when current and expected branches match', () => {
  const cwd = createTempDir();
  const sessionFilePath = path.join(cwd, '.git', 'rawsql', 'expected-branch');

  recordExpectedBranch('codex/749-branch-session-guard', cwd, {
    runGit: gitPathRunner('.git/rawsql/expected-branch'),
    sessionFilePath,
    currentBranch: 'codex/749-branch-session-guard',
  });

  const result = checkBranchExpectation(cwd, {
    runGit: gitPathRunner('.git/rawsql/expected-branch'),
    sessionFilePath,
    currentBranch: 'codex/749-branch-session-guard',
  });

  expect(result.ok).toBe(true);
  expect(result.code).toBe('ok');
});

test('checkBranchExpectation fails on mismatched branch', () => {
  const cwd = createTempDir();
  const sessionFilePath = path.join(cwd, '.git', 'rawsql', 'expected-branch');

  recordExpectedBranch('codex/749-branch-session-guard', cwd, {
    runGit: gitPathRunner('.git/rawsql/expected-branch'),
    sessionFilePath,
    currentBranch: 'codex/749-branch-session-guard',
  });

  const result = checkBranchExpectation(cwd, {
    runGit: gitPathRunner('.git/rawsql/expected-branch', 'codex/another-task'),
    sessionFilePath,
    currentBranch: 'codex/another-task',
  });

  expect(result.ok).toBe(false);
  expect(result.code).toBe('branch-mismatch');
  expect(result.message).toContain('Expected branch: codex/749-branch-session-guard');
  expect(result.message).toContain('Current branch: codex/another-task');
});

test('checkBranchExpectation fails on detached HEAD', () => {
  const cwd = createTempDir();
  const sessionFilePath = path.join(cwd, '.git', 'rawsql', 'expected-branch');

  const result = checkBranchExpectation(cwd, {
    runGit: gitPathRunner('.git/rawsql/expected-branch', ''),
    sessionFilePath,
    currentBranch: '',
    expectedBranch: 'codex/749-branch-session-guard',
  });

  expect(result.ok).toBe(false);
  expect(result.code).toBe('detached-head');
});

test('clearExpectedBranch removes the session file', () => {
  const cwd = createTempDir();
  const sessionFilePath = path.join(cwd, '.git', 'rawsql', 'expected-branch');

  recordExpectedBranch('codex/749-branch-session-guard', cwd, {
    runGit: gitPathRunner('.git/rawsql/expected-branch'),
    sessionFilePath,
    currentBranch: 'codex/749-branch-session-guard',
  });
  expect(existsSync(sessionFilePath)).toBe(true);

  clearExpectedBranch(cwd, {
    runGit: gitPathRunner('.git/rawsql/expected-branch'),
    sessionFilePath,
  });

  expect(existsSync(sessionFilePath)).toBe(false);
});

test('pre-push checks branch session before retro gate', () => {
  const prePushHook = readFileSync(path.resolve(__dirname, '../../../.husky/pre-push'), 'utf8');

  const branchIndex = prePushHook.indexOf('node scripts/branch-session-guard.js check');
  const retroIndex = prePushHook.indexOf('node scripts/check-retro-clean.js');

  expect(branchIndex).toBeGreaterThanOrEqual(0);
  expect(retroIndex).toBeGreaterThan(branchIndex);
});
