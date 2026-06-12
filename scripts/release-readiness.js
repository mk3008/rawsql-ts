const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const RELEASE_PR_HEAD_PREFIX = 'changeset-release/';

const RELEASE_READINESS_PATTERNS = [
  {
    kind: 'package-surface',
    patterns: [
      /^package\.json$/u,
      /^pnpm-lock\.yaml$/u,
      /^docs\/guide\/getting-started\.md$/u,
      /^packages\/(?:[^/]+\/)+src\//u,
      /^packages\/(?:[^/]+\/)+templates\//u,
      /^packages\/(?:[^/]+\/)+package\.json$/u,
      /^packages\/(?:[^/]+\/)+README\.md$/u,
      /^packages\/(?:[^/]+\/)+CHANGELOG\.md$/u,
    ],
  },
  {
    kind: 'publish-workflow',
    patterns: [
      /^\.github\/actions\/setup-publish-runtime\//u,
      /^\.github\/workflows\/(?:publish|release-pr|release-readiness)\.yml$/u,
      /^scripts\/(?:build-publish-artifacts|ci-publish|create-publish-proof-plan|publish-plan|publish-workspace-utils|release-readiness|sync-rawsql-dist|verify-publish-contract|verify-published-package-mode|verify-runtime-prereqs|version-packages-and-lockfile)\.(?:mjs|js)$/u,
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
    eventPath: null,
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
    if (arg === '--event-path') {
      options.eventPath = next;
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

function listPendingChangesetFiles(rootDir) {
  const changesetDir = path.join(rootDir, '.changeset');
  if (!fs.existsSync(changesetDir)) {
    return [];
  }

  return fs.readdirSync(changesetDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /^[^.].+\.md$/iu.test(name))
    .filter((name) => name.toLowerCase() !== 'readme.md')
    .map((name) => normalizePath(path.join('.changeset', name)))
    .sort();
}

function readPullRequestLabels(eventPath) {
  if (!eventPath || !fs.existsSync(eventPath)) {
    return [];
  }

  const payload = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const labels = payload?.pull_request?.labels;
  if (!Array.isArray(labels)) {
    return [];
  }

  return labels
    .map((label) => String(label?.name ?? '').trim())
    .filter(Boolean)
    .sort();
}

function readPullRequestContext(eventPath) {
  if (!eventPath || !fs.existsSync(eventPath)) {
    return {
      isReleasePr: false,
      headRef: '',
      title: '',
      authorLogin: '',
      labelNames: [],
    };
  }

  const payload = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const pullRequest = payload?.pull_request ?? {};
  const labels = Array.isArray(pullRequest.labels) ? pullRequest.labels : [];

  return {
    isReleasePr: typeof pullRequest.head?.ref === 'string' && pullRequest.head.ref.startsWith(RELEASE_PR_HEAD_PREFIX),
    headRef: typeof pullRequest.head?.ref === 'string' ? pullRequest.head.ref : '',
    title: typeof pullRequest.title === 'string' ? pullRequest.title : '',
    authorLogin: typeof pullRequest.user?.login === 'string' ? pullRequest.user.login : '',
    labelNames: labels
      .map((label) => String(label?.name ?? '').trim())
      .filter(Boolean)
      .sort(),
  };
}

function evaluateChangesetGuardrail({ releaseAffecting, changesetFiles, labelNames, isReleasePr = false }) {
  const normalizedLabels = (labelNames ?? []).map((label) => String(label).trim().toLowerCase());
  const hasNoReleaseLabel = normalizedLabels.includes('no-release');
  const hasChangeset = (changesetFiles ?? []).length > 0;
  const guardrailRequired = releaseAffecting && !isReleasePr;
  const guardrailPassed = isReleasePr || !guardrailRequired || hasChangeset || hasNoReleaseLabel;

  return {
    guardrailRequired,
    guardrailPassed,
    hasChangeset,
    hasNoReleaseLabel,
    isReleasePr,
  };
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
  const changesetFiles = listPendingChangesetFiles(process.cwd());
  const pullRequestContext = readPullRequestContext(options.eventPath ?? process.env.GITHUB_EVENT_PATH);
  const labelNames = pullRequestContext.labelNames;
  const guardrail = evaluateChangesetGuardrail({
    releaseAffecting: classification.releaseAffecting,
    changesetFiles,
    labelNames,
    isReleasePr: pullRequestContext.isReleasePr,
  });

  console.log(`[release-readiness] changed files: ${classification.changedFiles.length}`);
  if (classification.releaseAffecting) {
    console.log(`[release-readiness] matched kinds: ${classification.matchedKinds.join(', ')}`);
    for (const entry of classification.matchedFiles) {
      console.log(`[release-readiness] ${entry.filePath} -> ${entry.kinds.join(', ')}`);
    }
  } else {
    console.log('[release-readiness] no release-affecting file patterns matched.');
  }

  if (guardrail.guardrailRequired) {
    console.log(`[release-readiness] changesets present: ${guardrail.hasChangeset ? 'yes' : 'no'}`);
    console.log(`[release-readiness] no-release label present: ${guardrail.hasNoReleaseLabel ? 'yes' : 'no'}`);
    if (!guardrail.guardrailPassed) {
      console.log('[release-readiness] guardrail failed: release-affecting changes need a changeset or the no-release label.');
    }
  }
  if (pullRequestContext.isReleasePr) {
    console.log(`[release-readiness] release PR detected on ${pullRequestContext.headRef}; changeset guardrail is skipped for bot-authored version bump PRs.`);
  }

  appendGitHubOutputs(options.githubOutputPath, {
    release_affecting: classification.releaseAffecting ? 'true' : 'false',
    release_affecting_kinds: classification.matchedKinds.join(','),
    changeset_present: guardrail.hasChangeset ? 'true' : 'false',
    no_release_label_present: guardrail.hasNoReleaseLabel ? 'true' : 'false',
    changeset_guardrail_required: guardrail.guardrailRequired ? 'true' : 'false',
    changeset_guardrail_ok: guardrail.guardrailPassed ? 'true' : 'false',
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
  evaluateChangesetGuardrail,
  getMatchingKinds,
  listPendingChangesetFiles,
  readPullRequestContext,
  readPullRequestLabels,
  runReleaseReadinessChecks,
};
