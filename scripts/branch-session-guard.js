const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SESSION_GIT_PATH = 'rawsql/expected-branch';

function defaultRunGit(args, cwd = process.cwd()) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function parseCliArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === '--branch') {
      options.branch = rest[index + 1];
      index += 1;
      continue;
    }
    if (token === '--json') {
      options.json = true;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return {
    command: command || 'status',
    options,
  };
}

function resolveSessionFilePath(cwd = process.cwd(), runGit = defaultRunGit) {
  const gitPath = runGit(['rev-parse', '--git-path', SESSION_GIT_PATH], cwd);
  return path.resolve(cwd, gitPath);
}

function getCurrentBranch(cwd = process.cwd(), runGit = defaultRunGit) {
  return runGit(['branch', '--show-current'], cwd).trim();
}

function readExpectedBranch(sessionFilePath, readFile = fs.readFileSync, exists = fs.existsSync) {
  if (!exists(sessionFilePath)) {
    return null;
  }

  const value = readFile(sessionFilePath, 'utf8').trim();
  return value.length > 0 ? value : null;
}

function writeExpectedBranch(sessionFilePath, expectedBranch, mkdir = fs.mkdirSync, writeFile = fs.writeFileSync) {
  mkdir(path.dirname(sessionFilePath), { recursive: true });
  writeFile(sessionFilePath, `${expectedBranch}\n`, 'utf8');
}

function recordExpectedBranch(expectedBranch, cwd = process.cwd(), helpers = {}) {
  const runGit = helpers.runGit || defaultRunGit;
  const sessionFilePath = helpers.sessionFilePath || resolveSessionFilePath(cwd, runGit);
  const currentBranch = helpers.currentBranch || getCurrentBranch(cwd, runGit);

  if (!expectedBranch || expectedBranch.trim().length === 0) {
    throw new Error('Expected branch must be a non-empty string.');
  }

  if (!currentBranch) {
    throw new Error('Cannot record branch session in detached HEAD state.');
  }

  if (currentBranch !== expectedBranch) {
    throw new Error(
      `Current branch "${currentBranch}" does not match the expected branch "${expectedBranch}". Switch first, then record the session.`,
    );
  }

  writeExpectedBranch(
    sessionFilePath,
    expectedBranch,
    helpers.mkdir || fs.mkdirSync,
    helpers.writeFile || fs.writeFileSync,
  );

  return {
    currentBranch,
    expectedBranch,
    sessionFilePath,
  };
}

function checkBranchExpectation(cwd = process.cwd(), helpers = {}) {
  const runGit = helpers.runGit || defaultRunGit;
  const sessionFilePath = helpers.sessionFilePath || resolveSessionFilePath(cwd, runGit);
  const currentBranch = helpers.currentBranch || getCurrentBranch(cwd, runGit);
  const expectedBranch = helpers.expectedBranch !== undefined
    ? helpers.expectedBranch
    : readExpectedBranch(
      sessionFilePath,
      helpers.readFile || fs.readFileSync,
      helpers.exists || fs.existsSync,
    );

  if (!currentBranch) {
    return {
      ok: false,
      code: 'detached-head',
      currentBranch: '',
      expectedBranch,
      sessionFilePath,
      message: [
        '[branch-session] Detached HEAD is not allowed for guarded push.',
        '[branch-session] Switch to the intended branch, then run `pnpm guard:branch-session expect-current`.',
      ].join('\n'),
    };
  }

  if (!expectedBranch) {
    return {
      ok: false,
      code: 'missing-expected-branch',
      currentBranch,
      expectedBranch: null,
      sessionFilePath,
      message: [
        '[branch-session] No expected branch is recorded for this worktree session.',
        `[branch-session] Current branch: ${currentBranch}`,
        `[branch-session] Session file: ${sessionFilePath}`,
        '[branch-session] Run `pnpm guard:branch-session expect-current` after switching to the intended branch.',
      ].join('\n'),
    };
  }

  if (currentBranch !== expectedBranch) {
    return {
      ok: false,
      code: 'branch-mismatch',
      currentBranch,
      expectedBranch,
      sessionFilePath,
      message: [
        '[branch-session] Branch mismatch detected.',
        `[branch-session] Expected branch: ${expectedBranch}`,
        `[branch-session] Current branch: ${currentBranch}`,
        `[branch-session] Session file: ${sessionFilePath}`,
        '[branch-session] Stop and switch back, or explicitly re-record the new intended branch before pushing.',
      ].join('\n'),
    };
  }

  return {
    ok: true,
    code: 'ok',
    currentBranch,
    expectedBranch,
    sessionFilePath,
    message: [
      '[branch-session] Branch session matches.',
      `[branch-session] Current branch: ${currentBranch}`,
      `[branch-session] Session file: ${sessionFilePath}`,
    ].join('\n'),
  };
}

function clearExpectedBranch(cwd = process.cwd(), helpers = {}) {
  const runGit = helpers.runGit || defaultRunGit;
  const sessionFilePath = helpers.sessionFilePath || resolveSessionFilePath(cwd, runGit);
  const exists = helpers.exists || fs.existsSync;
  const unlink = helpers.unlink || fs.unlinkSync;

  if (exists(sessionFilePath)) {
    unlink(sessionFilePath);
  }

  return sessionFilePath;
}

function main() {
  const { command, options } = parseCliArgs(process.argv.slice(2));

  try {
    switch (command) {
      case 'expect-current': {
        const currentBranch = getCurrentBranch();
        const result = recordExpectedBranch(currentBranch);
        console.log(`[branch-session] Recorded expected branch: ${result.expectedBranch}`);
        console.log(`[branch-session] Session file: ${result.sessionFilePath}`);
        return;
      }
      case 'expect': {
        const result = recordExpectedBranch(options.branch);
        console.log(`[branch-session] Recorded expected branch: ${result.expectedBranch}`);
        console.log(`[branch-session] Session file: ${result.sessionFilePath}`);
        return;
      }
      case 'check': {
        const result = checkBranchExpectation();
        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(result.message);
        }
        if (!result.ok) {
          process.exit(1);
        }
        return;
      }
      case 'clear': {
        const sessionFilePath = clearExpectedBranch();
        console.log(`[branch-session] Cleared expected branch session: ${sessionFilePath}`);
        return;
      }
      case 'status': {
        const result = checkBranchExpectation();
        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(result.message);
        }
        return;
      }
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    console.error(`[branch-session] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  SESSION_GIT_PATH,
  checkBranchExpectation,
  clearExpectedBranch,
  getCurrentBranch,
  parseCliArgs,
  readExpectedBranch,
  recordExpectedBranch,
  resolveSessionFilePath,
  writeExpectedBranch,
};

if (require.main === module) {
  main();
}
