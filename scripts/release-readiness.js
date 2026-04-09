const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const RELEASE_READINESS_PATTERNS = [
  {
    kind: 'scaffold-layout',
    patterns: [
      /^package\.json$/u,
      /^pnpm-lock\.yaml$/u,
      /^packages\/ztd-cli\/package\.json$/u,
      /^packages\/ztd-cli\/src\/commands\/(?:feature|init)\.ts$/u,
      /^packages\/ztd-cli\/templates\//u,
      /^docs\/guide\/(?:generated-project-verification|sql-first-end-to-end-tutorial|ztd-local-source-dogfooding)\.md$/u,
    ],
  },
  {
    kind: 'package-publish-shape',
    patterns: [
      /^packages\/[^/]+\/package\.json$/u,
      /^packages\/[^/]+\/CHANGELOG\.md$/u,
      /^scripts\/sync-rawsql-dist\.js$/u,
    ],
  },
  {
    kind: 'publish-workflow',
    patterns: [
      /^\.github\/actions\/setup-publish-runtime\//u,
      /^\.github\/workflows\/(?:publish|release-pr|release-readiness)\.yml$/u,
      /^scripts\/(?:build-publish-artifacts|ci-publish|publish-plan|publish-workspace-utils|release-readiness|verify-publish-contract|verify-published-package-mode|verify-runtime-prereqs|version-packages-and-lockfile)\.(?:mjs|js)$/u,
    ],
  },
  {
    kind: 'release-notes',
    patterns: [
      /^\.changeset\/.+\.md$/u,
      /^docs\/guide\/release-readiness\.md$/u,
    ],
  },
];

function normalizePath(filePath) {
  return String(filePath).replace(/\\/gu, '/').replace(/^\.\//u, '');
}

function parseArgs(argv) {
  const options = {
    baseSha: null,
    headSha: null,
    githubOutputPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1] ?? null;

    if (arg === '--base-sha') {
      options.baseSha = next;
      index += 1;
      continue;
    }
    if (arg === '--head-sha') {
      options.headSha = next;
      index += 1;
      continue;
    }
    if (arg === '--github-output') {
      options.githubOutputPath = next;
      index += 1;
    }
  }

  return options;
}

function appendGitHubOutputs(filePath, outputs) {
  if (!filePath) {
    return;
  }

  const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value}`);
  fs.appendFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function getChangedFiles(baseSha, headSha) {
  if (!baseSha || !headSha) {
    throw new Error('release-readiness detect requires --base-sha and --head-sha.');
  }

  const output = execFileSync('git', ['diff', '--name-only', `${baseSha}...${headSha}`], {
    encoding: 'utf8',
  });

  return output
    .split(/\r?\n/u)
    .map((line) => normalizePath(line.trim()))
    .filter(Boolean);
}

function getMatchingKinds(filePath) {
  const normalized = normalizePath(filePath);
  return RELEASE_READINESS_PATTERNS
    .filter((entry) => entry.patterns.some((pattern) => pattern.test(normalized)))
    .map((entry) => entry.kind);
}

function classifyReleaseReadiness(changedFiles) {
  const normalizedFiles = changedFiles.map((filePath) => normalizePath(filePath)).filter(Boolean);
  const matchedFiles = normalizedFiles
    .map((filePath) => ({
      filePath,
      kinds: getMatchingKinds(filePath),
    }))
    .filter((entry) => entry.kinds.length > 0);
  const matchedKinds = Array.from(new Set(matchedFiles.flatMap((entry) => entry.kinds))).sort();

  return {
    releaseAffecting: matchedFiles.length > 0,
    changedFiles: normalizedFiles,
    matchedFiles,
    matchedKinds,
  };
}

function resolveExecutable(command) {
  return process.platform === 'win32' ? `${command}.cmd` : command;
}

function runCommand(label, command, args) {
  console.log(`[release-readiness] ${label}`);
  execFileSync(resolveExecutable(command), args, {
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
}

function runReleaseReadinessChecks() {
  runCommand(
    'Running published-package smoke and dist/export validation',
    'pnpm',
    ['verify:published-package-mode'],
  );
}

function runDetect(argv) {
  const options = parseArgs(argv);
  const classification = classifyReleaseReadiness(getChangedFiles(options.baseSha, options.headSha));

  console.log(`[release-readiness] changed files: ${classification.changedFiles.length}`);
  if (classification.releaseAffecting) {
    console.log(`[release-readiness] matched kinds: ${classification.matchedKinds.join(', ')}`);
    for (const entry of classification.matchedFiles) {
      console.log(`[release-readiness] ${entry.filePath} -> ${entry.kinds.join(', ')}`);
    }
  } else {
    console.log('[release-readiness] no release-affecting file patterns matched.');
  }

  appendGitHubOutputs(options.githubOutputPath, {
    release_affecting: classification.releaseAffecting ? 'true' : 'false',
    release_affecting_kinds: classification.matchedKinds.join(','),
  });
}

function main() {
  const [, , mode, ...rest] = process.argv;

  if (mode === 'detect') {
    runDetect(rest);
    return;
  }

  if (mode === 'check') {
    runReleaseReadinessChecks();
    return;
  }

  throw new Error('Expected one of: detect, check');
}

if (require.main === module) {
  main();
}

module.exports = {
  RELEASE_READINESS_PATTERNS,
  classifyReleaseReadiness,
  getMatchingKinds,
  runReleaseReadinessChecks,
};
