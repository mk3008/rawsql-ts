const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const CLI_SURFACE_PATTERNS = [
  /^packages\/ztd-cli\/src\/commands\//u,
  /^packages\/ztd-cli\/src\/index\.ts$/u,
  /^packages\/ztd-cli\/README\.md$/u,
  /^docs\/guide\/(?:query-uses-impact-checks|query-uses-overview|sql-first-end-to-end-tutorial|sql-tool-happy-paths|ztd-cli-agent-interface)\.md$/u,
];

const SCAFFOLD_CONTRACT_PATTERNS = [
  /^packages\/ztd-cli\/src\/commands\/(?:feature|init)\.ts$/u,
  /^packages\/ztd-cli\/templates\//u,
  /^packages\/ztd-cli\/tests\/(?:featureScaffold|featureTestsScaffold)\.unit\.test\.ts$/u,
  /^packages\/ztd-cli\/README\.md$/u,
  /^docs\/guide\/(?:generated-project-verification|sql-first-end-to-end-tutorial|ztd-local-source-dogfooding)\.md$/u,
];

const MERGE_NO_EXCEPTION_LABEL = 'No baseline exception requested.';
const MERGE_EXCEPTION_LABEL = 'Baseline exception requested and linked below.';
const CLI_NO_PACKET_LABEL = 'No migration packet required for this CLI change.';
const CLI_PACKET_LABEL = 'CLI/user-facing surface change and migration packet completed.';
const SCAFFOLD_NO_PROOF_LABEL = 'No scaffold contract proof required for this PR.';
const SCAFFOLD_PROOF_LABEL = 'Scaffold contract proof completed.';
const RELEASE_PR_HEAD_PREFIX = 'changeset-release/';

function normalizePath(filePath) {
  return String(filePath).replace(/\\/gu, '/').replace(/^\.\//u, '');
}

function parseArgs(argv) {
  const options = {
    baseSha: null,
    headSha: null,
    eventPath: process.env.GITHUB_EVENT_PATH ?? null,
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
    }
  }

  return options;
}

function classifyPullRequestContext(eventPath) {
  if (!eventPath || !fs.existsSync(eventPath)) {
    return {
      isReleasePr: false,
      headRef: '',
      title: '',
      authorLogin: '',
    };
  }

  const payload = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const pullRequest = payload.pull_request ?? {};
  const headRef = typeof pullRequest.head?.ref === 'string' ? pullRequest.head.ref : '';
  const title = typeof pullRequest.title === 'string' ? pullRequest.title : '';
  const authorLogin = typeof pullRequest.user?.login === 'string' ? pullRequest.user.login : '';

  return {
    isReleasePr: headRef.startsWith(RELEASE_PR_HEAD_PREFIX),
    headRef,
    title,
    authorLogin,
  };
}

function getChangedFiles(baseSha, headSha) {
  if (!baseSha || !headSha) {
    throw new Error('check-pr-readiness requires --base-sha and --head-sha.');
  }

  const output = execFileSync('git', ['diff', '--name-only', `${baseSha}...${headSha}`], {
    encoding: 'utf8',
  });

  return output
    .split(/\r?\n/u)
    .map((line) => normalizePath(line.trim()))
    .filter(Boolean);
}

function matchFiles(changedFiles, patterns) {
  return changedFiles
    .map((filePath) => normalizePath(filePath))
    .filter((filePath) => patterns.some((pattern) => pattern.test(filePath)));
}

function classifyPrReadiness(changedFiles) {
  const normalizedFiles = changedFiles.map((filePath) => normalizePath(filePath)).filter(Boolean);
  const cliMatchedFiles = matchFiles(normalizedFiles, CLI_SURFACE_PATTERNS);
  const scaffoldMatchedFiles = matchFiles(normalizedFiles, SCAFFOLD_CONTRACT_PATTERNS);

  return {
    changedFiles: normalizedFiles,
    requiresCliMigrationPacket: cliMatchedFiles.length > 0,
    requiresScaffoldContractProof: scaffoldMatchedFiles.length > 0,
    cliMatchedFiles,
    scaffoldMatchedFiles,
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function hasCheckedLine(body, label) {
  const pattern = new RegExp(`^\\s*- \\[(?:x|X)\\]\\s+${escapeRegex(label)}\\s*$`, 'mu');
  return pattern.test(body);
}

function countCheckedLines(body, labels) {
  return labels.filter((label) => hasCheckedLine(body, label)).length;
}

function extractField(body, label) {
  const pattern = new RegExp(`^${escapeRegex(label)}:[ \\t]*([^\\r\\n]*)$`, 'mu');
  const match = pattern.exec(body);
  return match ? match[1].trim() : '';
}

function isPlaceholderValue(value) {
  return (
    value.length === 0
    || /^<(?:.+)>$/u.test(value)
    || /^(?:todo|tbd|n\/a|na|none|same as above|\.\.\.)$/iu.test(value)
  );
}

function hasIssueReference(value) {
  return /#\d+/u.test(value) || /https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/issues\/\d+/u.test(value);
}

function requireField(errors, body, label, description, validator = null) {
  const value = extractField(body, label);
  if (isPlaceholderValue(value)) {
    errors.push(`${description} is required: "${label}:" must be filled in.`);
    return;
  }
  if (validator && !validator(value)) {
    errors.push(description);
  }
}

function validatePrReadiness({ body, classification, pullRequestContext = null }) {
  const errors = [];
  const normalizedBody = typeof body === 'string' ? body : '';
  const context = pullRequestContext ?? { isReleasePr: false };

  if (context.isReleasePr) {
    return {
      ok: true,
      errors,
      classification,
      skippedBecause: 'release-pr',
    };
  }

  if (!/##\s+Merge Readiness/iu.test(normalizedBody)) {
    errors.push('Missing "## Merge Readiness" section from the PR body.');
  }

  const mergeSelectionCount = countCheckedLines(normalizedBody, [
    MERGE_NO_EXCEPTION_LABEL,
    MERGE_EXCEPTION_LABEL,
  ]);
  if (mergeSelectionCount !== 1) {
    errors.push('Select exactly one Merge Readiness baseline-exception checkbox.');
  }

  if (hasCheckedLine(normalizedBody, MERGE_EXCEPTION_LABEL)) {
    requireField(
      errors,
      normalizedBody,
      'Tracking issue',
      'Merge Readiness tracking issue must link to the baseline remediation issue.',
      hasIssueReference,
    );
    requireField(
      errors,
      normalizedBody,
      'Scoped checks run',
      'Merge Readiness must name the scoped checks that were run.',
    );
    requireField(
      errors,
      normalizedBody,
      'Why full baseline is not required',
      'Merge Readiness must explain why the full baseline is not required for this PR.',
    );
  }

  if (classification.requiresCliMigrationPacket) {
    if (!/##\s+CLI Surface Migration/iu.test(normalizedBody)) {
      errors.push('Missing "## CLI Surface Migration" section for a CLI-facing change.');
    }

    const cliSelectionCount = countCheckedLines(normalizedBody, [
      CLI_NO_PACKET_LABEL,
      CLI_PACKET_LABEL,
    ]);
    if (cliSelectionCount !== 1) {
      errors.push('Select exactly one CLI Surface Migration checkbox.');
    }

    if (hasCheckedLine(normalizedBody, CLI_NO_PACKET_LABEL)) {
      requireField(
        errors,
        normalizedBody,
        'No-migration rationale',
        'CLI changes that skip a migration packet must explain why no migration packet is required.',
      );
    }

    if (hasCheckedLine(normalizedBody, CLI_PACKET_LABEL)) {
      requireField(errors, normalizedBody, 'Upgrade note', 'CLI migration packet must include an upgrade note.');
      requireField(
        errors,
        normalizedBody,
        'Deprecation/removal plan or issue',
        'CLI migration packet must include a deprecation/removal plan or tracking issue.',
      );
      requireField(
        errors,
        normalizedBody,
        'Docs/help/examples updated',
        'CLI migration packet must describe the docs/help/example alignment.',
      );
      requireField(
        errors,
        normalizedBody,
        'Release/changeset wording',
        'CLI migration packet must describe the release/changeset wording.',
      );
    }
  }

  if (classification.requiresScaffoldContractProof) {
    if (!/##\s+Scaffold Contract Proof/iu.test(normalizedBody)) {
      errors.push('Missing "## Scaffold Contract Proof" section for a scaffold-related change.');
    }

    const scaffoldSelectionCount = countCheckedLines(normalizedBody, [
      SCAFFOLD_NO_PROOF_LABEL,
      SCAFFOLD_PROOF_LABEL,
    ]);
    if (scaffoldSelectionCount !== 1) {
      errors.push('Select exactly one Scaffold Contract Proof checkbox.');
    }

    if (hasCheckedLine(normalizedBody, SCAFFOLD_NO_PROOF_LABEL)) {
      requireField(
        errors,
        normalizedBody,
        'No-proof rationale',
        'Scaffold-related changes that skip contract proof must explain why the proof is not required.',
      );
    }

    if (hasCheckedLine(normalizedBody, SCAFFOLD_PROOF_LABEL)) {
      requireField(
        errors,
        normalizedBody,
        'Non-edit assertion',
        'Scaffold contract proof must include a non-edit assertion.',
      );
      requireField(
        errors,
        normalizedBody,
        'Fail-fast input-contract proof',
        'Scaffold contract proof must include a fail-fast input-contract proof.',
      );
      requireField(
        errors,
        normalizedBody,
        'Generated-output viability proof',
        'Scaffold contract proof must include a generated-output viability proof.',
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    classification,
  };
}

function readPullRequestBody(eventPath) {
  if (!eventPath) {
    throw new Error('check-pr-readiness requires --event-path or GITHUB_EVENT_PATH.');
  }

  const payload = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  return typeof payload.pull_request?.body === 'string' ? payload.pull_request.body : '';
}

function runCheck(argv) {
  const options = parseArgs(argv);
  const changedFiles = getChangedFiles(options.baseSha, options.headSha);
  const classification = classifyPrReadiness(changedFiles);
  const body = readPullRequestBody(options.eventPath);
  const pullRequestContext = classifyPullRequestContext(options.eventPath);
  const validation = validatePrReadiness({ body, classification, pullRequestContext });

  console.log(`[pr-readiness] changed files: ${classification.changedFiles.length}`);
  if (pullRequestContext.isReleasePr) {
    console.log(`[pr-readiness] release PR detected on ${pullRequestContext.headRef}; skipping human-authored PR body contract.`);
  }
  if (classification.requiresCliMigrationPacket) {
    console.log(`[pr-readiness] CLI migration packet required for: ${classification.cliMatchedFiles.join(', ')}`);
  }
  if (classification.requiresScaffoldContractProof) {
    console.log(`[pr-readiness] Scaffold contract proof required for: ${classification.scaffoldMatchedFiles.join(', ')}`);
  }

  if (!validation.ok) {
    console.error('[pr-readiness] PR body did not satisfy the readiness contract.');
    for (const error of validation.errors) {
      console.error(`[pr-readiness] ${error}`);
    }
    process.exit(1);
  }

  console.log('[pr-readiness] ok');
}

function main() {
  runCheck(process.argv.slice(2));
}

if (require.main === module) {
  main();
}

module.exports = {
  CLI_SURFACE_PATTERNS,
  SCAFFOLD_CONTRACT_PATTERNS,
  classifyPullRequestContext,
  classifyPrReadiness,
  validatePrReadiness,
};
